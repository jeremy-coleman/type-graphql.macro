import type { MacroHandler } from "babel-plugin-macros"
import { createMacro } from "babel-plugin-macros"
import * as doctrine from "doctrine"
import type { NodePath, types as t } from "@babel/core"
import { findLast } from "lodash"
import { asserts, cap, cap_, last } from "./utils"
import { attachConstructors, filter } from "./predicates"
import { assertNodeType, getAsserts } from "./asserts"
import { getImportManager } from "./importManager"
import { DeductedType, getReifier } from "./reifier/index"
import { getTypeHelpers } from "./typeHelper"
import { Container, tokens } from "./di"

const { name: PKG_NAME } = PACKAGE_JSON
const importee = PKG_NAME + "/type-graphql"

export interface TypeGraphQLMacroConfig {
  /**
   * Emit code that uses parameter decorators
   * @default false
   */
  emitParameterDecorator?: boolean

  /**
   * Reified type map
   * @example
   * { "Types.ObjectId": "String" }
   */
  typeMap?: Record<string, string>

  /**
   * Add string class type names
   */
  addClassName?: boolean | "downlevel"
}

const handler: MacroHandler = ({ references, config, babel }) => {
  const {
    Arg = [],
    Args = [],
    Ctx = [],
    Field = [],
    FieldResolver = [],
    InputType = [],
    Ignore = [],
    Mutation = [],
    ObjectType = [],
    Query = [],
    Resolver = [],
    Root = [],
    AutoObjectType = [],
    AutoInputType = [],
    registerEnumType = [],
    classPropertyType = [],
    emitDecoratorMetadata = [],
  } = references as {
    [key: string]: NodePath<t.Identifier>[]
  }

  asserts(!references.default, `${PKG_NAME} cannot be used as a default import`)

  const { emitParameterDecorator, addClassName } = config as TypeGraphQLMacroConfig

  // Find a reference, any reference
  const [[anyRef]] = (Object.values(references) as NodePath<t.Identifier>[][]).filter(
    x => x.length
  )
  if (!anyRef) {
    console.warn(`${PKG_NAME} imported but not used, exiting`)
    return
  }

  const t = attachConstructors(babel.types)
  const container = Container.instantiate()
    .set(tokens.types, t)
    .set(tokens.babel, { ...babel, types: t })
    .set(tokens.config, config as TypeGraphQLMacroConfig)
    .setLazy(tokens.importManager, () => getImportManager({ anyRef, importee }))
    .setLazy(tokens.reifier, getReifier)
    .setLazy(tokens.typeHelpers, getTypeHelpers)
    .setLazy(tokens.asserts, getAsserts)

  const { addProperty } = container.import(tokens.typeHelpers)
  const { importDec, modules } = container.import(tokens.importManager)
  const { getType, getTypeFromLiteral } = container.import(tokens.reifier)
  const { assertCalledAsDecorator } = container.import(tokens.asserts)

  const {
    ArrayExpression,
    ArrowFunctionExpression,
    AssignmentPattern,
    BlockStatement,
    CallExpression,
    ClassDeclaration,
    ClassMethod,
    ClassProperty,
    Decorator,
    ExportDefaultDeclaration,
    ExportNamedDeclaration,
    FunctionExpression,
    Identifier,
    MemberExpression,
    ObjectExpression,
    ObjectProperty,
    ReturnStatement,
    StringLiteral,
    TSTypeReference,
    VariableDeclarator,
    valueToNode: valueToNode,
  } = t

  /**
   * Add a `description` field to a decorator option object argument from the
   * preceding leading comment if such one exists.
   */
  function addDescription(target: t.Node, object: ObjectExpression) {
    if (!target.leadingComments?.length) return

    const comment = last(target.leadingComments)
    const parsed = doctrine.parse(comment.value, { unwrap: true })
    addProperty(object, { description: parsed.description })
    const deprecated = parsed.tags.find(x => x.title === "deprecated")?.description
    if (deprecated != null) {
      addProperty(object, { deprecationReason: deprecated })
    }
  }

  const existingFields = Field.map(p => p.node)
  const ignoredFields = Ignore.map(p => p.node)

  // #region Handle `@Auto*` decorators
  function addFieldDecorators(path: NodePath<Identifier>) {
    const { targetPath } = assertCalledAsDecorator(path, [ClassDeclaration])
    const shouldSkip = ({ expression }: Decorator) =>
      expression instanceof CallExpression &&
      (existingFields.includes(expression.callee as any) ||
        ignoredFields.includes(expression.callee as any))

    targetPath
      .get("body")
      .get("body")
      .filter(cap_(t.isClassProperty))
      .forEach(path => {
        const { node } = path
        if (!node.decorators?.some(shouldSkip)) {
          node.decorators ??= []
          const [newPath] = path.pushContainer(
            "decorators" as never,
            new Decorator(new CallExpression(modules.typeGraphQL.import("Field"), []))
          )
          Field.push(newPath.get("expression.callee") as NodePath<Identifier>)
        }
      })
  }

  AutoInputType.forEach(path => {
    const [newPath] = path.replaceWith(modules.typeGraphQL.import("InputType"))
    InputType.push(newPath)
    addFieldDecorators(newPath)
  })

  AutoObjectType.forEach(path => {
    const [newPath] = path.replaceWith(modules.typeGraphQL.import("ObjectType"))
    ObjectType.push(newPath)
    addFieldDecorators(newPath)
  })

  // Delete references to `Auto*`.
  const specifiersLength = importDec.node.specifiers.length
  for (let i = specifiersLength - 1; i >= 0; i--) {
    const specifier = importDec.get(`specifiers.${i}`) as NodePath<ImportSpecifier>
    const name = filter(Identifier, specifier.node.imported)?.name
    if (name && /^Auto.+Type$/.test(name)) {
      specifier.remove()
    }
  }
  // #endregion

  Query.concat(Mutation)
    .concat(FieldResolver)
    .forEach(path => {
      const { args, target } = assertCalledAsDecorator(path, [ClassMethod])

      // There is already a type annotation, skip and carry on.
      if (
        args[0] instanceof ArrowFunctionExpression ||
        args[0] instanceof FunctionExpression
      ) {
        return
      }

      let returnType: DeductedType
      if (target.returnType) {
        let tsType = (target.returnType as TSTypeAnnotation).typeAnnotation
        if (
          tsType instanceof TSTypeReference &&
          t.isIdentifier(tsType.typeName, { name: "Promise" })
        ) {
          ;[tsType] = tsType.typeParameters!.params
        }
        returnType = getType(path, tsType)
      } else {
        const returnStatement = findLast(target.body.body, cap(t.isReturnStatement))
        returnType = DeductedType(getTypeFromLiteral(returnStatement?.argument), false)
      }

      if (returnType.type) {
        args.push(new ArrowFunctionExpression([], returnType.type))
        if (returnType.nullable) {
          args.push(valueToNode({ nullable: true }))
        }
      }
    })

  const moveParam = (path: NodePath<Identifier>) => {
    const { callExpression, target, targetPath } = assertCalledAsDecorator(path, [
      Identifier,
      t.isPattern,
    ])
    // Move from parameter decorator to method decorator
    const parent = targetPath.parentPath
    let index: number
    if (parent.node instanceof AssignmentPattern) {
      index = (parent.parent as ClassMethod).params.indexOf(parent.node)
    } else {
      index = (parent.node as ClassMethod).params.indexOf(target)
    }
    const method = path.findParent(t => t.isClassMethod()) as NodePath<ClassMethod>
    method.node.decorators ??= []
    method.node.decorators.push(
      new Decorator(
        new CallExpression(modules.tslib.import("__param"), [
          valueToNode(index),
          callExpression,
        ])
      )
    )
    path.parentPath.parentPath!.remove()
  }

  Arg.concat(Args)
    .concat(Ctx)
    .forEach(path => {
      const { args, target, targetPath } = assertCalledAsDecorator(path, [
        Identifier,
        t.isPattern,
      ])
      if (target instanceof AssignmentPattern) {
        const type = getType(
          path,
          (target.typeAnnotation as TSTypeAnnotation)?.typeAnnotation,
          target.right
        )
        args.push(valueToNode((target.left as Identifier).name))
        if (!(args[1] instanceof ArrowFunctionExpression)) {
          args.push(new ArrowFunctionExpression([], type.type!))
        }
        args.push(valueToNode({ nullable: true }))
      } else if (target instanceof Identifier) {
        const type = getType(
          path,
          (target.typeAnnotation as TSTypeAnnotation)?.typeAnnotation,
          (target as any).value
        )
        args.push(valueToNode(target.name))
        if (!(args[1] instanceof ArrowFunctionExpression)) {
          args.push(new ArrowFunctionExpression([], type.type!))
        }
        if (
          (target as Identifier).optional ||
          targetPath.parent instanceof AssignmentPattern
        ) {
          args.push(valueToNode({ nullable: true }))
        }
      }

      if (!emitParameterDecorator) {
        moveParam(path)
      }
    })

  Root.forEach(path => {
    const { args, target } = assertCalledAsDecorator(path, [Identifier, t.isPattern])
    const type = getType(path, (target.typeAnnotation as TSTypeAnnotation).typeAnnotation)

    args.push(new ArrowFunctionExpression([], type.type!))
    if (!emitParameterDecorator) {
      moveParam(path)
    }
  })

  classPropertyType.forEach(path => {
    const decorator = path.findParent((t): t is NodePath<Decorator> => t.isDecorator())
    asserts(decorator != null, "classPropertyType must be called inside a decorator")
    const property = assertNodeType(decorator.parent, ClassProperty)

    const { type } = getType(
      path,
      (property.typeAnnotation as TSTypeAnnotation)?.typeAnnotation,
      property.value
    )

    asserts(type != null, "Cannot deduct type for classPropertyType")

    path.replaceWith(new ArrowFunctionExpression([], type))
  })

  Field.forEach(path => {
    const { args, target } = assertCalledAsDecorator(path, [ClassProperty, ClassMethod])

    if (
      (target instanceof ClassProperty && (target.static || target.computed)) ||
      (target instanceof ClassMethod && target.kind !== "get")
    ) {
      return
    }

    const defaultValue = target instanceof ClassProperty ? target.value : undefined
    let { optional } = target

    const typeAn = (
      target instanceof ClassMethod ? target.returnType : target.typeAnnotation
    ) as TSTypeAnnotation

    if (!(args[0] instanceof ArrowFunctionExpression)) {
      const { type, nullable } = getType(path, typeAn?.typeAnnotation, defaultValue)
      if (type) {
        args.push(new ArrowFunctionExpression([], type))
      }
      if (nullable) {
        optional = true
      }
    }

    const options = new ObjectExpression([])
    if (optional) {
      addProperty(options, { nullable: true })
    }

    addDescription(target, options)

    if (defaultValue) {
      addProperty(options, { defaultValue })
    }

    if (options.properties.length) {
      args.push(options)
    }
  })

  function addClassNameToClass(targetPath: NodePath<ClassDeclaration>) {
    const target = targetPath.node

    if (addClassName === "downlevel") {
      const prop = new ClassMethod(
        "get",
        new Identifier("name"),
        [],
        new BlockStatement([new ReturnStatement(valueToNode(target.id.name))])
      )
      prop.static = true
      target.body.body.unshift(prop)
    } else if (addClassName) {
      const prop = new ClassProperty(new Identifier("name"), valueToNode(target.id.name))
      prop.static = true
      target.body.body.unshift(prop)
    }
  }

  ObjectType.forEach(path => {
    const { args, target, targetPath } = assertCalledAsDecorator(path, [ClassDeclaration])
    const options = new ObjectExpression([])
    if (target.superClass) {
      // options.properties.push(
      //   new ObjectProperty(new Identifier("implements"), target.superClass)
      // )
    }
    addClassNameToClass(targetPath)
    addDescription(target, options)
    if (options.properties.length) {
      args.push(options)
    }
  })

  InputType.forEach(path => {
    const { targetPath } = assertCalledAsDecorator(path, [ClassDeclaration])
    addClassNameToClass(targetPath)
  })

  Resolver.forEach(path => {
    const { args, target } = assertCalledAsDecorator(path, [ClassDeclaration])
    if (target.abstract) {
      args.push(addProperty(undefined, { isAbstract: true }))
    }
  })

  registerEnumType.forEach(path => {
    const callExp = assertNodeType(path.parent, CallExpression)
    const callParent = path.parentPath.parentPath!

    if (callExp.arguments.length === 1) {
      const [arg] = callExp.arguments
      const { name } =
        // registerEnum(EnumObject)
        filter(Identifier, arg) ??
          // registerEnum(namespace.EnumObject)
          filter(Identifier, filter(MemberExpression, arg)?.property) ??
          // let a = registerEnum({ ... })
          filter(
            Identifier,
            filter(VariableDeclarator, callParent.node)?.id
          ) ?? /* no idea */ {
            name: undefined,
          }

      if (!name) {
        throw new Error("Cannot deduct name for registerEnum() call")
      }

      if (
        arg instanceof ArrayExpression &&
        arg.elements.every(el => t.isExpression(el))
      ) {
        callExp.arguments[0] = new ObjectExpression(
          arg.elements.map(el => new ObjectProperty(el as Expression, el as Expression))
        )
      }

      const config = addProperty(undefined, { name })

      if (callParent.node instanceof VariableDeclarator) {
        const upperParent = callParent.parentPath!.parent

        const nodeMaybeWithComments = callParent.node.leadingComments?.length
          ? callParent.node
          : upperParent instanceof ExportNamedDeclaration ||
            upperParent instanceof ExportDefaultDeclaration
          ? upperParent
          : null

        if (nodeMaybeWithComments) {
          addDescription(nodeMaybeWithComments, config)
        }
      }
      callExp.arguments.push(config)
    }
  })

  emitDecoratorMetadata.forEach(path => {
    const decorator = assertNodeType(path.parentPath, Decorator)
    const target = assertNodeType(decorator.parent, [ClassMethod, ClassProperty])

    if (target instanceof ClassProperty) {
      const { type } = getType(
        path,
        (target.typeAnnotation as TSTypeAnnotation)?.typeAnnotation,
        target.value,
        true
      )

      path.replaceWith(
        new CallExpression(modules.tslib.import("__metadata"), [
          new StringLiteral("design:type"),
          type ?? new Identifier("Object"),
        ])
      )
    } else {
      // target is ClassMethod
      const args: Expression[] = []
      for (const param of target.params) {
        const toType = (typeAnnotation: TSTypeAnnotation, value: Expression) =>
          getType(path, typeAnnotation?.typeAnnotation, value, true).type ??
          new Identifier("Object")

        if (param instanceof AssignmentPattern) {
          args.push(toType(param.typeAnnotation as TSTypeAnnotation, param.right))
        } else if (param instanceof Identifier) {
          args.push(
            toType(param.typeAnnotation as TSTypeAnnotation, (param as any).right)
          )
        } else {
          args.push(new Identifier("Object"))
        }
      }

      const returnType =
        target.returnType &&
        getType(
          path,
          (target.returnType as TSTypeAnnotation).typeAnnotation,
          undefined,
          true
        ).type

      path.parentPath.replaceWithMultiple([
        new Decorator(
          new CallExpression(modules.tslib.import("__metadata"), [
            new StringLiteral("design:type"),
            new Identifier("Function"),
          ])
        ),
        new Decorator(
          new CallExpression(modules.tslib.import("__metadata"), [
            new StringLiteral("design:paramtypes"),
            new ArrayExpression(args),
          ])
        ),
        new Decorator(
          new CallExpression(modules.tslib.import("__metadata"), [
            new StringLiteral("design:returntype"),
            returnType ?? new Identifier("undefined"),
          ])
        ),
      ])
    }
  })

  importDec.traverse({
    ImportSpecifier(path) {
      if (t.isIdentifier(path.node.imported, { name: "Ignore" })) {
        path.remove()
      }
    },
  })

  Ignore.forEach(path => {
    assertCalledAsDecorator(path, [ClassProperty, ClassMethod])
    path.parentPath.parentPath!.remove()
  })

  return {
    keepImports: true,
  }
}

export default createMacro(handler, {
  configName: "typeGraphQL",
})
