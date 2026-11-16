import type { StoreErrorKind, StoreResult } from "./types";

/** Etiqueta corta de cada causa, para los lugares donde antes decía siempre "no respondió". */
export const ERROR_LABEL: Record<StoreErrorKind, string> = {
  connection: "sin conexión",
  timeout: "tardó demasiado",
  blocked: "bloqueó la consulta",
  http: "error del sitio",
  structure: "cambió su página",
  "empty-response": "respuesta vacía",
  processing: "error al procesar",
};

export function errorLabel(result: Pick<StoreResult, "errorKind"> | undefined): string {
  return (result?.errorKind && ERROR_LABEL[result.errorKind]) || "no se pudo consultar";
}
