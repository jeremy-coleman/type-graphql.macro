import { forEach } from "lodash"
import { container, tokens } from "./di"

export function getTypeHelpers() {
  const { types: t } = container.import(tokens.babel)
  const { Identifier, ObjectExpression, ObjectProperty, valueToNode } = t

  return {
    addProperty(
      obj: ObjectExpression = new ObjectExpression([]),
      props: Record<string, any>
    ) {
      forEach(props, (value, key) => {
        obj.properties.push(new ObjectProperty(new Identifier(key), valueToNode(value)))
      })
      return obj
    },
  }
}
