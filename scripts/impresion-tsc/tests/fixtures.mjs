export const TOKEN = 'token-de-prueba-sin-valor-real-0123456789';
export const ORIGIN = 'http://localhost:5173';
export const PRINTER = 'TSC TTP-247';
export const ID = '754a95c1-3497-45d4-8827-5279a0a03663';
export const HEADER = 'SIZE 96 mm,20 mm\r\nGAP 2 mm,0 mm\r\nDIRECTION 1\r\nREFERENCE 0,0\r\nOFFSET 0 mm\r\nSET TEAR ON\r\n';
export const PAGE = 'CLS\r\nBAR 16,16,2,80\r\nBAR 20,16,4,80\r\nTEXT 16,112,"1",0,1,1,"GG-000001"\r\nPRINT 1,1\r\n';
export const TSPL = HEADER + PAGE;
export const job = (overrides = {}) => ({ trabajoId: ID, impresora: PRINTER, tspl: TSPL, ...overrides });
export const configuration = (overrides = {}) => ({ origins: [ORIGIN], token: TOKEN, printer: PRINTER, dryRun: true, ...overrides });
