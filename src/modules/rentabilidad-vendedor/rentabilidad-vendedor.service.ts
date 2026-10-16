import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class RentabilidadVendedorService {
  constructor(private readonly entityManager: EntityManager) {}

  async getRentabilidadData(fechaInicio: string, fechaFin: string, empresa: string = '004'): Promise<any[]> {
    const emp = (empresa || '004').toString().padStart(3, '0');
    // Solo mostrar datos para empresa 004. Si es 003 u otra, devolver vacío.
    if (emp !== '004') {
      console.log('[RentabilidadService] Empresa no soportada para este módulo, devolviendo vacío:', emp);
      return [];
    }
    const comunDB = `[${emp}BDCOMUN]`;
    const contDB = `[${emp}BDCONTABILIDAD]`;
    const cbtDB  = `[${emp}BDCBT2025]`;
    console.log(`[RentabilidadService] Buscando datos entre: ${fechaInicio} y ${fechaFin} para empresa ${emp}`);

    const query = `
      WITH VentasCTE AS (
          SELECT
              cfvende,
              DES_VEN,
              SUM(A.DFCANTID * A.DFPREC_VEN / 1.18) AS VENTA_MES
          FROM ${comunDB}.[dbo].FACDET AS A
          INNER JOIN ${comunDB}.[dbo].FACCAB AS B ON A.DFTD = B.CFTD AND A.DFNUMSER = B.CFNUMSER AND A.DFNUMDOC = B.CFNUMDOC
          INNER JOIN ${comunDB}.[dbo].MAEART ON DFCODIGO = ACODIGO
          LEFT OUTER JOIN ${comunDB}.[dbo].VENDEDOR ON CFVENDE = COD_VEN
          WHERE A.DFESTADO = 'V'
            AND B.CFFECDOC BETWEEN @0 AND @1
            AND B.CFVENDE NOT IN ('10', '38')
            AND AFAMILIA <> '05'
          GROUP BY CFVENDE, DES_VEN
      ),
      CobranzasCTE AS (
          SELECT
              CVende AS cfvende,
              SUM(DEPIMPORTE) as Cobranza,
              ANE_TASA_DETRACC AS Basico,
              SUM(DEPIMPORTE / 1.18 * 0.03) AS Comision,
              (ANE_TASA_DETRACC + SUM(DEPIMPORTE / 1.18 * 0.03)) * 0.09 AS Essalud,
              (ANE_TASA_DETRACC + SUM(DEPIMPORTE / 1.18 * 0.03)) / 12 AS Promedio_Gratificacion,
              (ANE_TASA_DETRACC + SUM(DEPIMPORTE / 1.18 * 0.03)) / 2 / 12 AS Promedio_CTS
          FROM ${comunDB}.[dbo].plan_cob_cab a
          INNER JOIN ${comunDB}.[dbo].PLAN_COB_DET b ON cocnropla = DEPNROPLA
          INNER JOIN ${comunDB}.[dbo].MAECLI ON COD_CLIENTE1 = CCODCLI
          INNER JOIN ${comunDB}.[dbo].VENDEDOR ON CVENDE = COD_VEN
          INNER JOIN ${contDB}.[dbo].[anexo] ON TIPOANEX_CODIGO = '04' AND ANEX_CODIGO = NUM_DOC
          WHERE COCFECPLA BETWEEN @0 AND @1
          GROUP BY CVende, des_ven, ANE_TASA_DETRACC
      ),
      ViaticosCTE AS (
          SELECT
              COD_VEN AS cfvende,
              SUM(CB_N_MTOMN) AS Viaticos
          FROM ${cbtDB}.[dbo].[CMOV_BANCO]
          LEFT OUTER JOIN ${comunDB}.[dbo].VENDEDOR ON SUBSTRING(CB_C_ANEXO, 3, 8) = num_doc
          WHERE CB_D_FECHA BETWEEN @0 AND @1
          GROUP BY COD_VEN, des_ven
      ),
      ResultadosBase AS (
          SELECT
              v.cfvende,
              v.DES_VEN,
              ISNULL(v.VENTA_MES, 0) AS VENTA_MES,
              ISNULL(c.Cobranza, 0) AS Cobranza,
              ISNULL(c.Basico, 0) AS Basico,
              ISNULL(c.Comision, 0) AS Comision,
              ISNULL(c.Essalud, 0) AS Essalud,
              ISNULL(c.Promedio_Gratificacion, 0) AS Promedio_Gratificacion,
              ISNULL(c.Promedio_CTS, 0) AS Promedio_CTS,
              ISNULL(vi.Viaticos, 0) AS Viaticos,
              0 AS Pasajes
          FROM VentasCTE v
          LEFT JOIN CobranzasCTE c ON v.cfvende = c.cfvende
          LEFT JOIN ViaticosCTE vi ON v.cfvende = vi.cfvende
      )
      SELECT
          *,
          (Basico + Comision + Essalud + Promedio_Gratificacion + Promedio_CTS + Viaticos + Pasajes) AS Total_Costo,
          (VENTA_MES - (Basico + Comision + Essalud + Promedio_Gratificacion + Promedio_CTS + Viaticos + Pasajes)) AS Rentabilidad,
          CASE
              WHEN VENTA_MES = 0 THEN 0
              ELSE (VENTA_MES - (Basico + Comision + Essalud + Promedio_Gratificacion + Promedio_CTS + Viaticos + Pasajes)) / VENTA_MES
          END AS Porcentaje_Rentabilidad
      FROM ResultadosBase
      ORDER BY cfvende;
    `;

    console.log('[RentabilidadService] Ejecutando query para', emp);
    console.log('[RentabilidadService] Con parámetros:', [fechaInicio, fechaFin]);

    try {
      const result = await this.entityManager.query(query, [fechaInicio, fechaFin]);
      console.log('[RentabilidadService] Resultado de la consulta:', result);
      
      // Calcular totales
      if (result.length > 0) {
        const totales = {
          cfvende: 'TOTAL',
          DES_VEN: 'TOTALES',
          VENTA_MES: result.reduce((sum, item) => sum + (parseFloat(item.VENTA_MES) || 0), 0),
          Cobranza: result.reduce((sum, item) => sum + (parseFloat(item.Cobranza) || 0), 0),
          Basico: result.reduce((sum, item) => sum + (parseFloat(item.Basico) || 0), 0),
          Comision: result.reduce((sum, item) => sum + (parseFloat(item.Comision) || 0), 0),
          Essalud: result.reduce((sum, item) => sum + (parseFloat(item.Essalud) || 0), 0),
          Promedio_Gratificacion: result.reduce((sum, item) => sum + (parseFloat(item.Promedio_Gratificacion) || 0), 0),
          Promedio_CTS: result.reduce((sum, item) => sum + (parseFloat(item.Promedio_CTS) || 0), 0),
          Viaticos: result.reduce((sum, item) => sum + (parseFloat(item.Viaticos) || 0), 0),
          Pasajes: result.reduce((sum, item) => sum + (parseFloat(item.Pasajes) || 0), 0),
          Total_Costo: result.reduce((sum, item) => sum + (parseFloat(item.Total_Costo) || 0), 0),
          Rentabilidad: result.reduce((sum, item) => sum + (parseFloat(item.Rentabilidad) || 0), 0),
          Porcentaje_Rentabilidad: 0, // Se calculará en el frontend
          isTotal: true // Flag para identificar la fila de totales
        };
        
        // Calcular porcentaje de rentabilidad total
        if (totales.VENTA_MES > 0) {
          totales.Porcentaje_Rentabilidad = totales.Rentabilidad / totales.VENTA_MES;
        }
        
        // Agregar la fila de totales al final
        result.push(totales);
      }
      
      return result;
    } catch (error) {
      console.error('[RentabilidadService] !!! ERROR al ejecutar la consulta !!!', error);
      throw error;
    }
  }
}
