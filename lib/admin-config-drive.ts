/**
 * Shared Google Drive folder where Admin selects Dashboard / Card Configuration
 * files. Client-safe constants only (no Node APIs).
 */
export const ADMIN_CONFIG_DRIVE_FOLDER_ID = "1g-pGEPe4f2sFmX0sngp-4Pm75ONGMnks";

export const ADMIN_CONFIG_DRIVE_FOLDER_URL =
  `https://drive.google.com/drive/u/0/folders/${ADMIN_CONFIG_DRIVE_FOLDER_ID}`;

export type AdminConfigDriveFileKind = "dashboard" | "card";
