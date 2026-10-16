import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { DatabaseService } from '../database.service';
// Carga perezosa para evitar error TS2307 si el paquete aún no está instalado
let ExcelJS: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ExcelJS = require('exceljs');
} catch (_) {
  ExcelJS = null;
}

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    @InjectConnection('comunDb')
    private connection: Connection,
    private databaseService: DatabaseService
  ) {}

  async getPedidos(usuEmpresa: string, fechaInicio?: string, fechaFin?: string): Promise<any[]> {
    this.logger.debug('Fetching pedidos report');
    try {
      // Devolver cabecera de pedidos para múltiples estados y respetar rango de fechas
      const dbName = this.databaseService.getDatabaseName(usuEmpresa);
      this.logger.debug(`getPedidos: usuEmpresa='${usuEmpresa}' -> db='${dbName}' fi='${fechaInicio}' ff='${fechaFin}'`);
      let query = `
                SELECT 
                  cod_ven       AS C_Vendedor,
                  des_ven       AS N_Vendedor,
                  pc.CFNUMPED   AS CFNUMPED,
                  CONVERT(VARCHAR, PC.CFFECDOC, 23) AS CFFECDOC,
                  PC.CFCOTIZA   AS CFCOTIZA,
                  PC.CFNOMBRE   AS CFNOMBRE
                FROM [${dbName}].[dbo].[PEDCAB] AS PC
                INNER JOIN [${dbName}].[dbo].[VENDEDOR] ON COD_VEN = CFVENDE
                WHERE PC.CFCOTIZA IN ('PARCIAL','AUTORIZADO')`;

      const params: any[] = [];
      if (fechaInicio && fechaFin) {
        query += ` AND CAST(PC.CFFECDOC AS DATE) BETWEEN @0 AND @1`;
        params.push(fechaInicio, fechaFin);
      } else {
        query += ` AND YEAR(PC.CFFECDOC) = YEAR(GETDATE()) AND MONTH(PC.CFFECDOC) = MONTH(GETDATE())`;
      }
      query += `
                ORDER BY cod_ven, pc.CFNUMPED;`;

      const result = params.length > 0
        ? await this.connection.query(query, params)
        : await this.connection.query(query);
      return result;
    } catch (error) {
      this.logger.error(`Error in getPedidos: ${error.message}`);
      throw error;
    }
  }

  async getPedidosEmitidos(usuEmpresa: string, fechaInicio?: string, fechaFin?: string): Promise<any[]> {
    this.logger.debug('Fetching pedidos emitidos list (JSON)');
    try {
      const dbName = this.databaseService.getDatabaseName(usuEmpresa) || '004BDCOMUN';
      this.logger.debug(`getPedidosEmitidos: usuEmpresa='${usuEmpresa}' -> db='${dbName}' fi='${fechaInicio}' ff='${fechaFin}'`);
      let query = `
                SELECT 
                    cod_ven AS C_Vendedor, 
                    des_ven AS N_Vendedor, 
                    pc.CFNUMPED AS Pedido, 
                    CONVERT(VARCHAR, PC.CFFECDOC, 103) AS Fecha_Pedido,  
                    PC.CFCOTIZA AS Estado, 
                    pc.CFCODCLI AS RUC, 
                    PC.cfnombre AS N_Cliente, 
                    PD.DFCODIGO AS Código, 
                    adescri AS Descripción,
                    (PD.DFCANTID) AS Cantidad_Pedido, 
                    PD.DFSALDO AS Cantidad_Pendiente, 
                    DFPREC_VEN/1.18 AS Precio_S_IGV, 
                    PD.DFCANTID*DFPREC_VEN/1.18 AS Venta_S_IGV, 
                    PD.DFCANTID*STKPREPRO AS Costo, 
                    PD.DFCANTID*DFPREC_VEN/1.18 - PD.DFCANTID*STKPREPRO AS MARGEN_MN, 
                    STSKDIS AS Stock
                FROM [${dbName}].[dbo].[PEDCAB] AS PC 
                INNER JOIN [${dbName}].[dbo].[PEDDET] AS PD ON PD.DFNUMPED = PC.CFNUMPED 
                INNER JOIN [${dbName}].[dbo].[MAEART] ON PD.DFCODIGO = ACODIGO 
                INNER JOIN [${dbName}].[dbo].[STKART] ON dfalma = STALMA and ACODIGO = STCODIGO 
                INNER JOIN [${dbName}].[dbo].[VENDEDOR] ON COD_VEN = CFVENDE
                WHERE (PC.CFCOTIZA IN ('ATENDIDO','EMITIDOS'))`;

      let params: any[] = [];
      if (fechaInicio && fechaFin) {
        // Filtro sargable
        query += ` AND PC.CFFECDOC >= @0 AND PC.CFFECDOC < DATEADD(DAY, 1, @1)`;
        params = [fechaInicio, fechaFin];
      } else {
        query += ` AND YEAR(PC.CFFECDOC) = YEAR(GETDATE()) AND MONTH(PC.CFFECDOC) = MONTH(GETDATE())`;
      }

      query += ` ORDER BY cod_ven, pc.CFNUMPED;`;

      return params.length > 0
        ? await this.connection.query(query, params)
        : await this.connection.query(query);
    } catch (error) {
      this.logger.error(`Error in getPedidosEmitidos: ${error.message}`);
      throw error;
    }
  }

  async exportPedidosEmitidosExcel(usuEmpresa: string, fechaInicio?: string, fechaFin?: string): Promise<Buffer> {
    this.logger.debug('Exporting pedidos emitidos to Excel');
    const rows = await this.getPedidosEmitidos(usuEmpresa, fechaInicio, fechaFin);
    const headers = [
      'C_Vendedor',
      'N_Vendedor',
      'Pedido',
      'Fecha_Pedido',
      'Estado',
      'RUC',
      'N_Cliente',
      'Código',
      'Descripción',
      'Cantidad_Pedido',
      'Cantidad_Pendiente',
      'Precio_S_IGV',
      'Venta_S_IGV',
      'Costo',
      'MARGEN_MN',
      'Stock'
    ];
    const norm = (r: any) => ({
      'C_Vendedor': r.C_Vendedor ?? r.cod_ven ?? r.COD_VEN ?? null,
      'N_Vendedor': r.N_Vendedor ?? r.des_ven ?? r.DES_VEN ?? null,
      'Pedido': r.Pedido ?? r.CFNUMPED ?? r.PEDIDO ?? null,
      'Fecha_Pedido': r.Fecha_Pedido ?? r.CFFECDOC ?? r.FECHA_PEDIDO ?? null,
      'Estado': r.Estado ?? r.CFCOTIZA ?? null,
      'RUC': r.RUC ?? r.CFCODCLI ?? null,
      'N_Cliente': r.N_Cliente ?? r.CFNOMBRE ?? null,
      'Código': r['Código'] ?? r.DFCODIGO ?? r.CÓDIGO ?? null,
      'Descripción': r['Descripción'] ?? r.ADESCRI ?? r.DESCRIPCIÓN ?? null,
      'Cantidad_Pedido': r.Cantidad_Pedido ?? r.DFCANTID ?? r.CANTIDAD_PEDIDO ?? null,
      'Cantidad_Pendiente': r.Cantidad_Pendiente ?? r.DFSALDO ?? null,
      'Precio_S_IGV': r.Precio_S_IGV ?? (r.DFPREC_VEN != null ? r.DFPREC_VEN / 1.18 : null),
      'Venta_S_IGV': r.Venta_S_IGV ?? (r.DFCANTID != null && r.DFPREC_VEN != null ? r.DFCANTID * r.DFPREC_VEN / 1.18 : null),
      'Costo': r.Costo ?? (r.DFCANTID != null && r.STKPREPRO != null ? r.DFCANTID * r.STKPREPRO : null),
      'MARGEN_MN': r.MARGEN_MN ?? (
        (r.Venta_S_IGV != null && r.Costo != null)
          ? (r.Venta_S_IGV - r.Costo)
          : (r.DFCANTID != null && r.DFPREC_VEN != null && r.STKPREPRO != null)
            ? (r.DFCANTID * r.DFPREC_VEN / 1.18) - (r.DFCANTID * r.STKPREPRO)
            : null
      ),
      'Stock': r.Stock ?? r.STSKDIS ?? null,
    });
    const mapped = rows.map(norm);
    if (!ExcelJS) {
      throw new Error("Dependencia 'exceljs' no instalada. Ejecuta: npm install exceljs");
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Emitidos');
    ws.addRow(headers);
    for (const r of rows) {
      const row = norm(r);
      ws.addRow([
        row['C_Vendedor'],
        row['N_Vendedor'],
        row['Pedido'],
        row['Fecha_Pedido'],
        row['Estado'],
        row['RUC'],
        row['N_Cliente'],
        row['Código'],
        row['Descripción'],
        row['Cantidad_Pedido'],
        row['Cantidad_Pendiente'],
        row['Precio_S_IGV'],
        row['Venta_S_IGV'],
        row['Costo'],
        row['MARGEN_MN'],
        row['Stock'],
      ]);
    }
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: ws.rowCount, column: headers.length },
    };
    ws.columns = headers.map(() => ({ width: 18 }));
    const buf: any = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
 

  async getPedidosDetalle(usuEmpresa: string, fechaInicio?: string, fechaFin?: string): Promise<any[]> {
    this.logger.debug('Fetching pedidos detalle report');
    try {
      const dbName = this.databaseService.getDatabaseName(usuEmpresa);
      this.logger.debug(`getPedidosDetalle: usuEmpresa='${usuEmpresa}' -> db='${dbName}' fi='${fechaInicio}' ff='${fechaFin}'`);
      let query = `
                SELECT 
                    COD_VEN, 
                    DES_VEN, 
                    PC.CFNUMPED AS PEDIDO, 
                    CONVERT(VARCHAR, PC.CFFECDOC, 103) AS FECHA_PEDIDO,  
                    PC.CFCOTIZA, 
                    PC.CFCODCLI, 
                    PC.CFNOMBRE, 
                    PD.DFCODIGO AS CÓDIGO, 
                    ADESCRI AS DESCRIPCIÓN, 
                    PD.DFSALDO AS CANTIDAD_PEDIDO, 
                    STSKDIS AS SALDO,   
                    (STSKDIS - PD.DFSALDO) AS DISPONIBLE
                FROM 
                    [${dbName}].[dbo].[PEDCAB] AS PC 
                    INNER JOIN [${dbName}].[dbo].[PEDDET] AS PD ON PD.DFNUMPED = PC.CFNUMPED 
                    INNER JOIN [${dbName}].[dbo].[MAEART] ON PD.DFCODIGO = ACODIGO 
                    INNER JOIN [${dbName}].[dbo].[STKART] ON DFALMA = STALMA AND ACODIGO = STCODIGO 
                    INNER JOIN [${dbName}].[dbo].[VENDEDOR] ON COD_VEN = CFVENDE
                WHERE 
                    PC.CFCOTIZA IN ('AUTORIZADO', 'PARCIAL') 
                    AND PD.DFSALDO > 0 
                    AND (STSKDIS - PD.DFSALDO) < 0`;

      let params: any[] = [];
      if (fechaInicio && fechaFin) {
        query += ` AND CAST(PC.CFFECDOC AS DATE) BETWEEN @0 AND @1`;
        params = [fechaInicio, fechaFin];
      } else {
        query += ` AND YEAR(CFFECDOC) = YEAR(GETDATE()) AND MONTH(CFFECDOC) = MONTH(GETDATE())`;
      }

      query += `
                ORDER BY 
                    COD_VEN, PC.CFNUMPED;`;

      const result = params.length > 0
        ? await this.connection.query(query, params)
        : await this.connection.query(query);
      return result;
    } catch (error) {
      this.logger.error(`Error in getPedidosDetalle: ${error.message}`);
      throw error;
    }
  }

  async getOrdenesFabricacionRecientes(usuEmpresa: string): Promise<any[]> {
    this.logger.debug('Fetching recent ordenes de fabricacion');
    try {
      this.logger.debug(`getOrdenesFabricacionRecientes: usuEmpresa='${usuEmpresa}'`);
      // Resolver BDs dinámicamente por empresa
      const dbName = this.databaseService.getDatabaseName(usuEmpresa); // 003BDCOMUN | 004BDCOMUN
      const prodDbName = dbName.replace('BDCOMUN', 'BDPRODUCCION');    // 003BDPRODUCCION | 004BDPRODUCCION

      // Inferir código de empresa para UNIDAD_NEGOCIO
      const empresaCode = dbName.startsWith('002') ? '002' : dbName.startsWith('003') ? '003' : '004';
      const unidadNegocio = `UNE${empresaCode}`;

      const query = `
                SELECT TOP (10)
                    OFAB.[ESTADO_OF],
                    OFAB.[ACODIGO],
                    MAE.[ADESCRI],
                    OFAB.[FECHA_FAB]
                FROM 
                    [${prodDbName}].[dbo].[ORDEN_FABRICACION] AS OFAB
                    INNER JOIN [${dbName}].[dbo].[MAEART] AS MAE ON MAE.ACODIGO = OFAB.ACODIGO
                WHERE 
                    OFAB.UNIDAD_NEGOCIO = '${unidadNegocio}' 
                    AND YEAR(OFAB.FECHA_FAB) = YEAR(GETDATE()) 
                    AND MONTH(OFAB.FECHA_FAB) = MONTH(GETDATE())
                ORDER BY 
                    OFAB.ID_ORDFABRICACION DESC;`;
      const result = await this.connection.query(query);
      return result;
    } catch (error) {
      this.logger.error(`Error in getOrdenesFabricacionRecientes: ${error.message}`);
      throw error;
    }
  }

  async getPedidosMargen(usuEmpresa: string, fechaInicio: string, fechaFin: string): Promise<any[]> {
    this.logger.debug('Fetching pedidos margen report');
    try {
      // Cambia el nombre de la base de datos según tu lógica de empresa
      const dbName = this.databaseService.getDatabaseName(usuEmpresa) || '004BDCOMUN';
      this.logger.debug(`getPedidosMargen: usuEmpresa='${usuEmpresa}' -> db='${dbName}' fi='${fechaInicio}' ff='${fechaFin}'`);
      const query = `
                SELECT 
                    cod_ven AS C_Vendedor, 
                    des_ven AS N_Vendedor, 
                    pc.CFNUMPED AS Pedido, 
                    CONVERT(VARCHAR, PC.CFFECDOC, 103) AS Fecha_Pedido,  
                    PC.CFCOTIZA AS Estado, 
                    pc.CFCODCLI AS RUC, 
                    PC.cfnombre AS N_Cliente, 
                    PD.DFCODIGO AS Código, 
                    adescri AS Descripción,
                    (PD.DFCANTID) AS Cantidad_Pedido, 
                    PD.DFSALDO AS Cantidad_Pendiente, 
                    DFPREC_VEN/1.18 AS Precio_S_IGV, 
                    PD.DFCANTID*DFPREC_VEN/1.18 AS Venta_S_IGV, 
                    PD.DFCANTID*STKPREPRO AS Costo, 
                    PD.DFCANTID*DFPREC_VEN/1.18 - PD.DFCANTID*STKPREPRO AS MARGEN_MN, 
                    STSKDIS AS Stock
                FROM 
                    [${dbName}].[dbo].[PEDCAB] AS PC 
                    INNER JOIN [${dbName}].[dbo].[PEDDET] AS PD ON PD.DFNUMPED = PC.CFNUMPED 
                    INNER JOIN [${dbName}].[dbo].[MAEART] ON PD.DFCODIGO = ACODIGO 
                    INNER JOIN [${dbName}].[dbo].[STKART] ON dfalma = STALMA AND ACODIGO = STCODIGO 
                    INNER JOIN [${dbName}].[dbo].[VENDEDOR] ON COD_VEN = CFVENDE
                WHERE 
                    (PC.CFCOTIZA IN ('AUTORIZADO','PARCIAL', 'ATENDIDO')) 
                    AND CAST(PC.CFFECDOC AS DATE) BETWEEN @0 AND @1
                ORDER BY 
                    cod_ven, pc.CFNUMPED;
            `;
      const result = await this.connection.query(query, [fechaInicio, fechaFin]);
      return result;
    } catch (error) {
      this.logger.error(`Error in getPedidosMargen: ${error.message}`);
      throw error;
    }
  }

  // Export Excel del reporte de margen con subtotales por F. Código (sin cambiar el layout original)
  async exportPedidosMargenExcel(usuEmpresa: string, fechaInicio: string, fechaFin: string): Promise<Buffer> {
    this.logger.debug('Exporting pedidos margen to Excel (with family subtotals)');
    if (!ExcelJS) {
      throw new Error("Dependencia 'exceljs' no instalada. Ejecuta: npm install exceljs");
    }
    // Reusar la misma data del endpoint JSON
    const data = await this.getPedidosMargen(usuEmpresa, fechaInicio, fechaFin);

    // Normalizar y enriquecer con F_Codigo (primeros 2 dígitos de Código)
    const norm = (r: any) => {
      const codigo = r['Código'] ?? r.DFCODIGO ?? r.CODIGO ?? r.CÓDIGO ?? null;
      const venta = r.Venta_S_IGV ?? (r.DFCANTID != null && r.DFPREC_VEN != null ? r.DFCANTID * r.DFPREC_VEN / 1.18 : null);
      const costo = r.Costo ?? (r.DFCANTID != null && r.STKPREPRO != null ? r.DFCANTID * r.STKPREPRO : null);
      const margen = r.MARGEN_MN ?? (
        venta != null && costo != null ? (venta - costo) : null
      );
      const cantidad = r.Cantidad_Pedido ?? r.DFCANTID ?? null;
      const fCodigo = typeof codigo === 'string' ? codigo.substring(0, 2) : null;
      const margenPct = venta && venta !== 0 ? (margen ?? 0) / venta : null;
      return {
        F_Codigo: fCodigo,
        C_Vendedor: r.C_Vendedor ?? r.cod_ven ?? r.COD_VEN ?? null,
        N_Vendedor: r.N_Vendedor ?? r.des_ven ?? r.DES_VEN ?? null,
        Pedido: r.Pedido ?? r.CFNUMPED ?? r.PEDIDO ?? null,
        Fecha_Pedido: r.Fecha_Pedido ?? r.CFFECDOC ?? r.FECHA_PEDIDO ?? null,
        Estado: r.Estado ?? r.CFCOTIZA ?? null,
        RUC: r.RUC ?? r.CFCODCLI ?? null,
        N_Cliente: r.N_Cliente ?? r.CFNOMBRE ?? null,
        Codigo: codigo,
        Descripcion: r['Descripción'] ?? r.ADESCRI ?? r.DESCRIPCIÓN ?? null,
        Cantidad: cantidad,
        Precio_S_IGV: r.Precio_S_IGV ?? (r.DFPREC_VEN != null ? r.DFPREC_VEN / 1.18 : null),
        Venta_S_IGV: venta,
        Costo: costo,
        Margen_MN: margen,
        Margen_Pct: margenPct,
        Stock: r.Stock ?? r.STSKDIS ?? null,
      };
    };
    const rows = data.map(norm);

    // Ordenar por F_Codigo y Pedido para un agrupado estable
    rows.sort((a, b) => {
      const fa = a.F_Codigo ?? '';
      const fb = b.F_Codigo ?? '';
      if (fa < fb) return -1; if (fa > fb) return 1;
      const pa = String(a.Pedido ?? '');
      const pb = String(b.Pedido ?? '');
      if (pa < pb) return -1; if (pa > pb) return 1;
      return 0;
    });

    const headers = [
      'F_Codigo',
      'C_Vendedor',
      'N_Vendedor',
      'Pedido',
      'Fecha_Pedido',
      'Estado',
      'RUC',
      'N_Cliente',
      'Código',
      'Descripción',
      'Cantidad',
      'Precio_S_IGV',
      'Venta_S_IGV',
      'Costo',
      'MARGEN_MN',
      'MARGEN_%',
      'Stock',
    ];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Margen_Ventas');
    ws.addRow(headers);

    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Acumuladores por familia y total general
    let curFam: string | null = null;
    let famCant = 0, famVenta = 0, famCosto = 0, famMargen = 0;
    let totCant = 0, totVenta = 0, totCosto = 0, totMargen = 0;

    const flushSubtotal = () => {
      if (curFam == null) return;
      // Construir una fila del mismo tamaño que headers, colocando valores solo donde corresponde al layout del usuario
      const subtotalRow: any[] = new Array(headers.length).fill('');
      // Col B (índice 1): etiqueta SUB TOTAL
      subtotalRow[1] = 'SUB TOTAL';
      // Según headers actuales:
      // 10 -> Cantidad (columna K)
      // 12 -> Venta_S_IGV (columna M)
      // 13 -> Costo (columna N)
      // 14 -> MARGEN_MN (columna O)
      // 15 -> MARGEN_% (columna P)
      subtotalRow[10] = famCant;
      subtotalRow[12] = famVenta;
      subtotalRow[13] = famCosto;
      subtotalRow[14] = famMargen;
      subtotalRow[15] = famVenta ? famMargen / famVenta : null;

      const row = ws.addRow(subtotalRow);
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
        cell.font = { bold: true };
        cell.border = { top: { style: 'thin' } } as any;
      });
      famCant = famVenta = famCosto = famMargen = 0;
    };

    for (const r of rows) {
      const fam = r.F_Codigo ?? '';
      if (curFam !== null && fam !== curFam) {
        flushSubtotal();
      }
      if (curFam === null) curFam = fam;

      ws.addRow([
        r.F_Codigo,
        r.C_Vendedor,
        r.N_Vendedor,
        r.Pedido,
        r.Fecha_Pedido,
        r.Estado,
        r.RUC,
        r.N_Cliente,
        r.Codigo,
        r.Descripcion,
        r.Cantidad,
        r.Precio_S_IGV,
        r.Venta_S_IGV,
        r.Costo,
        r.Margen_MN,
        r.Margen_Pct,
        r.Stock,
      ]);

      // acumular
      const c = Number(r.Cantidad ?? 0) || 0;
      const v = Number(r.Venta_S_IGV ?? 0) || 0;
      const co = Number(r.Costo ?? 0) || 0;
      const m = Number(r.Margen_MN ?? (v - co)) || 0;
      famCant += c; famVenta += v; famCosto += co; famMargen += m;
      totCant += c; totVenta += v; totCosto += co; totMargen += m;
    }

    // último subtotal
    flushSubtotal();

    // Total general
    const totalRow = ws.addRow([
      'TOTAL', '', '', '', '', '', '', '', '', '',
      totCant, '', totVenta, totCosto, totMargen, totVenta ? totMargen / totVenta : null, ''
    ]);
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
      cell.font = { bold: true };
      cell.border = { top: { style: 'thin' } } as any;
    });

    // AutoFilter y anchos
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: headers.length } };
    ws.columns = headers.map(() => ({ width: 16 }));

    const buf: any = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async getPedidosParciales(usuEmpresa: string, fechaInicio?: string, fechaFin?: string): Promise<any[]> {
    this.logger.debug('Fetching pedidos parciales list (JSON)');
    try {
      const dbName = this.databaseService.getDatabaseName(usuEmpresa) || '004BDCOMUN';
      this.logger.debug(`getPedidosParciales: usuEmpresa='${usuEmpresa}' -> db='${dbName}' fi='${fechaInicio}' ff='${fechaFin}'`);
      let query = `
                SELECT 
                    cod_ven C_Vendedor, 
                    des_ven N_Vendedor, 
                    pc.CFNUMPED Pedido, 
                    CONVERT(VARCHAR, PC.CFFECDOC, 103) Fecha_Pedido, 
                    PC.CFCOTIZA Estado, 
                    pc.CFCODCLI RUC, 
                    PC.cfnombre N_Cliente, 
                    PD.DFCODIGO Código, 
                    adescri Descripción,
                    (PD.DFCANTID) AS Cantidad_Pedido, 
                    PD.DFSALDO Cantidad_Pendiente, 
                    DFPREC_VEN/1.18 Precio_S_IGV, 
                    PD.DFCANTID*DFPREC_VEN/1.18  Venta_S_IGV, 
                    PD.DFCANTID*STKPREPRO Costo, 
                    PD.DFCANTID*DFPREC_VEN/1.18 - PD.DFCANTID*STKPREPRO MARGEN_MN, 
                    STSKDIS Stock
                FROM [${dbName}].[dbo].[PEDCAB] AS PC 
                INNER JOIN [${dbName}].[dbo].[PEDDET] AS PD ON PD.DFNUMPED = PC.CFNUMPED 
                INNER JOIN [${dbName}].[dbo].[MAEART] ON PD.DFCODIGO = ACODIGO 
                INNER JOIN [${dbName}].[dbo].[STKART] ON dfalma = STALMA AND ACODIGO = STCODIGO 
                INNER JOIN [${dbName}].[dbo].[VENDEDOR] ON COD_VEN = CFVENDE
                WHERE (PC.CFCOTIZA  in ('PARCIAL')) 
                  AND PD.DFSALDO > 0 `;

      let params: any[] = [];
      if (fechaInicio && fechaFin) {
        this.logger.debug(`PARCIALES using RANGE fi=${fechaInicio} ff=${fechaFin}`);
        // Usar filtro sargable: >= fi y < ff + 1 día (evita CAST sobre columna)
        query += ` AND PC.CFFECDOC >= @0 AND PC.CFFECDOC < DATEADD(DAY, 1, @1)`;
        params = [fechaInicio, fechaFin];
      } else {
        this.logger.debug('PARCIALES using DEFAULT current month filter');
        query += ` AND YEAR(PC.CFFECDOC) = YEAR(GETDATE()) AND MONTH(PC.CFFECDOC) = MONTH(GETDATE())`;
      }

      query += ` ORDER BY cod_ven, pc.CFNUMPED;`;

      this.logger.debug(`PARCIALES final SQL paramsCount=${params.length}`);
      return params.length > 0
        ? await this.connection.query(query, params)
        : await this.connection.query(query);
    } catch (error) {
      this.logger.error(`Error in getPedidosParciales: ${error.message}`);
      throw error;
    }
  }

  async exportPedidosParcialesExcel(usuEmpresa: string, fechaInicio?: string, fechaFin?: string): Promise<Buffer> {
    this.logger.debug('Exporting pedidos parciales to Excel');
    const rows = await this.getPedidosParcialesForExport(usuEmpresa, fechaInicio, fechaFin);
    const headers = [
      'C_Vendedor',
      'N_Vendedor',
      'Pedido',
      'Fecha_Pedido',
      'Estado',
      'RUC',
      'N_Cliente',
      'Código',
      'Descripción',
      'Cantidad_Pedido',
      'Cantidad_Pendiente',
      'Precio_S_IGV',
      'Venta_S_IGV',
      'Costo',
      'MARGEN_MN',
      'Stock'
    ];
    const norm = (r: any) => ({
      'C_Vendedor': r.C_Vendedor ?? r.cod_ven ?? r.COD_VEN ?? null,
      'N_Vendedor': r.N_Vendedor ?? r.des_ven ?? r.DES_VEN ?? null,
      'Pedido': r.Pedido ?? r.CFNUMPED ?? r.PEDIDO ?? null,
      'Fecha_Pedido': r.Fecha_Pedido ?? r.CFFECDOC ?? r.FECHA_PEDIDO ?? null,
      'Estado': r.Estado ?? r.CFCOTIZA ?? null,
      'RUC': r.RUC ?? r.CFCODCLI ?? null,
      'N_Cliente': r.N_Cliente ?? r.CFNOMBRE ?? null,
      'Código': r['Código'] ?? r.DFCODIGO ?? r.CÓDIGO ?? null,
      'Descripción': r['Descripción'] ?? r.ADESCRI ?? r.DESCRIPCIÓN ?? null,
      'Cantidad_Pedido': r.Cantidad_Pedido ?? r.DFCANTID ?? r.CANTIDAD_PEDIDO ?? null,
      'Cantidad_Pendiente': r.Cantidad_Pendiente ?? r.DFSALDO ?? null,
      'Precio_S_IGV': r.Precio_S_IGV ?? (r.DFPREC_VEN != null ? r.DFPREC_VEN / 1.18 : null),
      'Venta_S_IGV': r.Venta_S_IGV ?? (r.DFCANTID != null && r.DFPREC_VEN != null ? r.DFCANTID * r.DFPREC_VEN / 1.18 : null),
      'Costo': r.Costo ?? (r.DFCANTID != null && r.STKPREPRO != null ? r.DFCANTID * r.STKPREPRO : null),
      'MARGEN_MN': r.MARGEN_MN ?? r.MARGEN_M ?? (
        (r.Venta_S_IGV != null && r.Costo != null)
          ? (r.Venta_S_IGV - r.Costo)
          : (r.DFCANTID != null && r.DFPREC_VEN != null && r.STKPREPRO != null)
            ? (r.DFCANTID * r.DFPREC_VEN / 1.18) - (r.DFCANTID * r.STKPREPRO)
            : null
      ),
      'Stock': r.Stock ?? r.STSKDIS ?? null,
    });
    const mapped = rows.map(norm);
    if (!ExcelJS) {
      throw new Error("Dependencia 'exceljs' no instalada. Ejecuta: npm install exceljs");
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Parciales');
    ws.addRow(headers);
    for (const r of mapped) {
      ws.addRow([
        r['C_Vendedor'],
        r['N_Vendedor'],
        r['Pedido'],
        r['Fecha_Pedido'],
        r['Estado'],
        r['RUC'],
        r['N_Cliente'],
        r['Código'],
        r['Descripción'],
        r['Cantidad_Pedido'],
        r['Cantidad_Pendiente'],
        r['Precio_S_IGV'],
        r['Venta_S_IGV'],
        r['Costo'],
        r['MARGEN_MN'],
        r['Stock'],
      ]);
    }
    // Estilos de cabecera en azul
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: ws.rowCount, column: headers.length },
    };
    ws.columns = headers.map(() => ({ width: 18 }));
    const buf: any = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // Consulta exclusiva para el EXPORT de PARCIALES (columnas completas, igual que AUTORIZADOS)
  private async getPedidosParcialesForExport(usuEmpresa: string, fechaInicio?: string, fechaFin?: string): Promise<any[]> {
    const dbName = this.databaseService.getDatabaseName(usuEmpresa) || '004BDCOMUN';
    this.logger.debug(`getPedidosParcialesForExport: usuEmpresa='${usuEmpresa}' -> db='${dbName}' fi='${fechaInicio}' ff='${fechaFin}'`);
    let query = `
                SELECT 
                    cod_ven AS C_Vendedor,
                    des_ven AS N_Vendedor,
                    pc.CFNUMPED AS Pedido,
                    CONVERT(VARCHAR, PC.CFFECDOC, 103) AS Fecha_Pedido,
                    PC.CFCOTIZA AS Estado,
                    pc.CFCODCLI AS RUC,
                    PC.cfnombre AS N_Cliente,
                    PD.DFCODIGO AS Código,
                    adescri AS Descripción,
                    (PD.DFCANTID) AS Cantidad_Pedido,
                    PD.DFSALDO AS Cantidad_Pendiente,
                    DFPREC_VEN/1.18 AS Precio_S_IGV,
                    PD.DFCANTID*DFPREC_VEN/1.18 AS Venta_S_IGV,
                    PD.DFCANTID*STKPREPRO AS Costo,
                    PD.DFCANTID*DFPREC_VEN/1.18 - PD.DFCANTID*STKPREPRO AS MARGEN_MN,
                    STSKDIS AS Stock
                FROM 
                    [${dbName}].[dbo].[PEDCAB] AS PC 
                    INNER JOIN [${dbName}].[dbo].[PEDDET] AS PD ON PD.DFNUMPED = PC.CFNUMPED 
                    INNER JOIN [${dbName}].[dbo].[MAEART] ON PD.DFCODIGO = ACODIGO 
                    INNER JOIN [${dbName}].[dbo].[STKART] ON dfalma = STALMA AND ACODIGO = STCODIGO 
                    INNER JOIN [${dbName}].[dbo].[VENDEDOR] ON COD_VEN = CFVENDE
                WHERE 
                    (PC.CFCOTIZA IN ('PARCIAL')) 
                    AND PD.DFSALDO > 0`;

    let params: any[] = [];
    if (fechaInicio && fechaFin) {
      // Filtro sargable (evita CAST sobre columna)
      query += ` AND PC.CFFECDOC >= @0 AND PC.CFFECDOC < DATEADD(DAY, 1, @1)`;
      params = [fechaInicio, fechaFin];
    } else {
      query += ` AND YEAR(PC.CFFECDOC) = YEAR(GETDATE()) AND MONTH(PC.CFFECDOC) = MONTH(GETDATE())`;
    }

    query += ` ORDER BY cod_ven, pc.CFNUMPED;`;

    return params.length > 0
      ? await this.connection.query(query, params)
      : await this.connection.query(query);
  }


  async getPedidosAutorizados(usuEmpresa: string, fechaInicio?: string, fechaFin?: string): Promise<any[]> {
    this.logger.debug('Fetching pedidos autorizados list (JSON)');
    try {
      const dbName = this.databaseService.getDatabaseName(usuEmpresa) || '004BDCOMUN';
      this.logger.debug(`getPedidosAutorizados: usuEmpresa='${usuEmpresa}' -> db='${dbName}' fi='${fechaInicio}' ff='${fechaFin}'`);
      let query = `
                SELECT 
                    cod_ven C_Vendedor, 
                    des_ven N_Vendedor, 
                    pc.CFNUMPED Pedido, 
                    CONVERT(VARCHAR, PC.CFFECDOC, 103) Fecha_Pedido, 
                    PC.CFCOTIZA Estado, 
                    pc.CFCODCLI RUC, 
                    PC.cfnombre N_Cliente, 
                    PD.DFCODIGO Código, 
                    adescri Descripción,
                    (PD.DFCANTID) AS Cantidad_Pedido, 
                    PD.DFSALDO Cantidad_Pendiente, 
                    DFPREC_VEN/1.18 Precio_S_IGV, 
                    PD.DFCANTID*DFPREC_VEN/1.18  Venta_S_IGV, 
                    PD.DFCANTID*STKPREPRO Costo, 
                    PD.DFCANTID*DFPREC_VEN/1.18 - PD.DFCANTID*STKPREPRO MARGEN_MN, 
                    STSKDIS Stock
                FROM [${dbName}].[dbo].[PEDCAB] AS PC 
                INNER JOIN [${dbName}].[dbo].[PEDDET] AS PD ON PD.DFNUMPED = PC.CFNUMPED 
                INNER JOIN [${dbName}].[dbo].[MAEART] ON PD.DFCODIGO = ACODIGO 
                INNER JOIN [${dbName}].[dbo].[STKART] ON dfalma = STALMA and ACODIGO = STCODIGO 
                INNER JOIN [${dbName}].[dbo].[VENDEDOR] ON COD_VEN = CFVENDE
                WHERE (PC.CFCOTIZA  in ('AUTORIZADO', 'PARCIAL', 'ATENDIDO')) 
                  AND PD.DFSALDO > 0 `;

      let params: any[] = [];
      if (fechaInicio && fechaFin) {
        query += ` AND CAST(PC.CFFECDOC AS DATE) BETWEEN @0 AND @1`;
        params = [fechaInicio, fechaFin];
      } else {
        query += ` AND YEAR(PC.CFFECDOC) = YEAR(GETDATE()) AND MONTH(PC.CFFECDOC) = MONTH(GETDATE())`;
      }

      query += ` AND (STSKDIS - PD.DFSALDO) < 0
                  ORDER BY cod_ven, pc.CFNUMPED`;

      return params.length > 0
        ? await this.connection.query(query, params)
        : await this.connection.query(query);
    } catch (error) {
      this.logger.error(`Error in getPedidosAutorizados: ${error.message}`);
      throw error;
    }
  }

  async exportPedidosAutorizadosExcel(usuEmpresa: string, fechaInicio?: string, fechaFin?: string): Promise<Buffer> {
    this.logger.debug('Exporting pedidos autorizados to Excel');
    const rows = await this.getPedidosAutorizadosForExport(usuEmpresa, fechaInicio, fechaFin);
    const headers = [
      'C_Vendedor',
      'N_Vendedor',
      'Pedido',
      'Fecha_Pedido',
      'Estado',
      'RUC',
      'N_Cliente',
      'Código',
      'Descripción',
      'Cantidad_Pedido',
      'Cantidad_Pendiente',
      'Precio_S_IGV',
      'Venta_S_IGV',
      'Costo',
      'MARGEN_MN',
      'Stock'
    ];
    const norm = (r: any) => ({
      'C_Vendedor': r.C_Vendedor ?? r.cod_ven ?? r.COD_VEN ?? null,
      'N_Vendedor': r.N_Vendedor ?? r.des_ven ?? r.DES_VEN ?? null,
      'Pedido': r.Pedido ?? r.CFNUMPED ?? r.PEDIDO ?? null,
      'Fecha_Pedido': r.Fecha_Pedido ?? r.CFFECDOC ?? r.FECHA_PEDIDO ?? null,
      'Estado': r.Estado ?? r.CFCOTIZA ?? null,
      'RUC': r.RUC ?? r.CFCODCLI ?? null,
      'N_Cliente': r.N_Cliente ?? r.CFNOMBRE ?? null,
      'Código': r['Código'] ?? r.DFCODIGO ?? r.CÓDIGO ?? null,
      'Descripción': r['Descripción'] ?? r.ADESCRI ?? r.DESCRIPCIÓN ?? null,
      'Cantidad_Pedido': r.Cantidad_Pedido ?? r.DFCANTID ?? r.CANTIDAD_PEDIDO ?? null,
      'Cantidad_Pendiente': r.Cantidad_Pendiente ?? r.DFSALDO ?? null,
      'Precio_S_IGV': r.Precio_S_IGV ?? (r.DFPREC_VEN != null ? r.DFPREC_VEN / 1.18 : null),
      'Venta_S_IGV': r.Venta_S_IGV ?? (r.DFCANTID != null && r.DFPREC_VEN != null ? r.DFCANTID * r.DFPREC_VEN / 1.18 : null),
      'Costo': r.Costo ?? (r.DFCANTID != null && r.STKPREPRO != null ? r.DFCANTID * r.STKPREPRO : null),
      'MARGEN_MN': r.MARGEN_MN ?? r.MARGEN_M ?? (
        (r.Venta_S_IGV != null && r.Costo != null)
          ? (r.Venta_S_IGV - r.Costo)
          : (r.DFCANTID != null && r.DFPREC_VEN != null && r.STKPREPRO != null)
            ? (r.DFCANTID * r.DFPREC_VEN / 1.18) - (r.DFCANTID * r.STKPREPRO)
            : null
      ),
      'Stock': r.Stock ?? r.STSKDIS ?? null,
    });
    const mapped = rows.map(norm);
    if (!ExcelJS) {
      throw new Error("Dependencia 'exceljs' no instalada. Ejecuta: npm install exceljs");
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Autorizados');
    ws.addRow(headers);
    for (const r of mapped) {
      ws.addRow([
        r['C_Vendedor'],
        r['N_Vendedor'],
        r['Pedido'],
        r['Fecha_Pedido'],
        r['Estado'],
        r['RUC'],
        r['N_Cliente'],
        r['Código'],
        r['Descripción'],
        r['Cantidad_Pedido'],
        r['Cantidad_Pendiente'],
        r['Precio_S_IGV'],
        r['Venta_S_IGV'],
        r['Costo'],
        r['MARGEN_MN'],
        r['Stock'],
      ]);
    }
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: ws.rowCount, column: headers.length },
    };
    ws.columns = headers.map(() => ({ width: 18 }));
    const buf: any = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // Consulta exclusiva para el EXPORT de autorizados
  // (mismo patrón que PARCIALES pero filtrando solo AUTORIZADO)
  private async getPedidosAutorizadosForExport(usuEmpresa: string, fechaInicio?: string, fechaFin?: string): Promise<any[]> {
    const dbName = this.databaseService.getDatabaseName(usuEmpresa) || '004BDCOMUN';
    this.logger.debug(`getPedidosAutorizadosForExport: usuEmpresa='${usuEmpresa}' -> db='${dbName}' fi='${fechaInicio}' ff='${fechaFin}'`);
    let query = `
                SELECT 
                    cod_ven AS C_Vendedor,
                    des_ven AS N_Vendedor,
                    pc.CFNUMPED AS Pedido,
                    CONVERT(VARCHAR, PC.CFFECDOC, 103) AS Fecha_Pedido,
                    PC.CFCOTIZA AS Estado,
                    pc.CFCODCLI AS RUC,
                    PC.cfnombre AS N_Cliente,
                    PD.DFCODIGO AS Código,
                    adescri AS Descripción,
                    (PD.DFCANTID) AS Cantidad_Pedido,
                    PD.DFSALDO AS Cantidad_Pendiente,
                    DFPREC_VEN/1.18 AS Precio_S_IGV,
                    PD.DFCANTID*DFPREC_VEN/1.18 AS Venta_S_IGV,
                    PD.DFCANTID*STKPREPRO AS Costo,
                    PD.DFCANTID*DFPREC_VEN/1.18 - PD.DFCANTID*STKPREPRO AS MARGEN_MN,
                    STSKDIS AS Stock
                FROM 
                    [${dbName}].[dbo].[PEDCAB] AS PC 
                    INNER JOIN [${dbName}].[dbo].[PEDDET] AS PD ON PD.DFNUMPED = PC.CFNUMPED 
                    INNER JOIN [${dbName}].[dbo].[MAEART] ON PD.DFCODIGO = ACODIGO 
                    INNER JOIN [${dbName}].[dbo].[STKART] ON dfalma = STALMA AND ACODIGO = STCODIGO 
                    INNER JOIN [${dbName}].[dbo].[VENDEDOR] ON COD_VEN = CFVENDE
                WHERE 
                    (PC.CFCOTIZA IN ('AUTORIZADO','PARCIAL','ATENDIDO')) 
                    AND PD.DFSALDO > 0 
                    AND (STSKDIS - PD.DFSALDO) < 0`;

    let params: any[] = [];
    if (fechaInicio && fechaFin) {
      query += ` AND CAST(PC.CFFECDOC AS DATE) BETWEEN @0 AND @1`;
      params = [fechaInicio, fechaFin];
    } else {
      query += ` AND YEAR(PC.CFFECDOC) = YEAR(GETDATE()) AND MONTH(PC.CFFECDOC) = MONTH(GETDATE())`;
    }

    query += ` ORDER BY cod_ven, pc.CFNUMPED;`;

    return params.length > 0
      ? await this.connection.query(query, params)
      : await this.connection.query(query);
  }
}