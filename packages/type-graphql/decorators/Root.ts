import { getMetadataStorage } from "../metadata/getMetadataStorage"
import { findType } from "../helpers/findType"
import { TypeValueThunk } from "./types"
import { SymbolKeysNotSupportedError } from "../errors"

export function Root(getType?: TypeValueThunk): ParameterDecorator
export function Root(propertyName?: string, getType?: TypeValueThunk): ParameterDecorator

export function Root(propertyName?: any, getType?: TypeValueThunk): ParameterDecorator {
  return (prototype, propertyKey, parameterIndex) => {
    if (typeof propertyKey === "symbol") {
      throw new SymbolKeysNotSupportedError()
    }
    if (typeof propertyName === "function") {
      getType = propertyName
      propertyName = undefined
    }

    if (!getType) {
      try {
        const typeInfo = findType({
          metadataKey: "design:paramtypes",
          prototype,
          propertyKey,
          parameterIndex,
        })
        getType = typeInfo.getType
      } catch {
        // tslint:disable-next-line:no-empty
      }
    }

    getMetadataStorage().collectHandlerParamMetadata({
      kind: "root",
      target: prototype.constructor,
      methodName: propertyKey,
      index: parameterIndex,
      propertyName,
      getType,
    })
  }
}
