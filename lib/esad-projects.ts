/** Shared Drive folder that holds one Google Sheet per ESAD board card. */
export const ESAD_DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1rzUg72NQvjyvbNVi2Y7yH36uT6wiMylj";

export const AVIONICS_MASTER_SCHEDULE_PERMALINK =
  "https://app.smartsheet.com/sheets/MQWP7M7WVcg7J7q5JFqvwV8mMpHVMx8w3wmXwMW1";

export type EsadProjectCode = "DSB" | "HVFB" | "PRI" | "IND";

export type EsadProjectIntegration = {
  code: EsadProjectCode;
  /** Smartsheet Task Name under ESAD BOARDS on Avionics Master Schedule. */
  smartsheetTaskName: string;
  /**
   * Google Spreadsheet file id for Open Tasks / Over Due.
   * Override with ESAD_GOOGLE_SHEET_ID_<CODE> when the Drive folder is private.
   */
  googleSheetId: string | null;
};

function envSheetId(code: EsadProjectCode): string | null {
  const key = `ESAD_GOOGLE_SHEET_ID_${code}`;
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;

  const fromGlobal = (globalThis as Record<string, string | undefined>)[key];
  return fromGlobal?.trim() || null;
}

/** Public Google Sheets for each ESAD board (override with ESAD_GOOGLE_SHEET_ID_<CODE>). */
const DEFAULT_GOOGLE_SHEET_IDS: Record<EsadProjectCode, string | null> = {
  DSB: "1RbnLe7FBrnT1njFWnsVyW74Iq2N5miTH9vFmRwagzps",
  HVFB: "1CQrxwKHPkqQhaFarLwiuUW9zUMU_yTRlfArl_lNzdZ8",
  PRI: "1kW_IlmrhvNfyVXYB-5gph5UOo1wR40SaaL1oZgLr29U",
  IND: "1ZjX1S4u3OfrCWuNbITP8CltV0tNezXpml7V8dQqur4M",
};

export const ESAD_PROJECT_INTEGRATIONS: Record<
  EsadProjectCode,
  EsadProjectIntegration
> = {
  DSB: {
    code: "DSB",
    smartsheetTaskName: "Digital Safety Board (DSB)",
    googleSheetId: envSheetId("DSB") ?? DEFAULT_GOOGLE_SHEET_IDS.DSB,
  },
  HVFB: {
    code: "HVFB",
    smartsheetTaskName: "High Voltage Fireset Board (HVFB)",
    googleSheetId: envSheetId("HVFB") ?? DEFAULT_GOOGLE_SHEET_IDS.HVFB,
  },
  PRI: {
    code: "PRI",
    smartsheetTaskName: "CPLD - Primary",
    googleSheetId: envSheetId("PRI") ?? DEFAULT_GOOGLE_SHEET_IDS.PRI,
  },
  IND: {
    code: "IND",
    smartsheetTaskName: "CPLD - Independent",
    googleSheetId: envSheetId("IND") ?? DEFAULT_GOOGLE_SHEET_IDS.IND,
  },
};

export function googleSheetEditUrl(sheetId: string | null | undefined): string {
  if (!sheetId) return ESAD_DRIVE_FOLDER_URL;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=drive_link`;
}

export function googleSheetCsvUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}

export function smartsheetRowUrl(rowId: number): string {
  return `${AVIONICS_MASTER_SCHEDULE_PERMALINK}?rowId=${rowId}`;
}
