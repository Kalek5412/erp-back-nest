import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { FechaDisponibleDto } from '../dto/produccion/fecha-disponible.dto';
import { ProduccionDetalleDto } from '../dto/produccion/produccion-detalle.dto';
import { ConsultaDetallesDto } from '../dto/produccion/consulta-detalles.dto';
import { ProduccionResumenDto } from '../dto/produccion/produccion-resumen.dto';

@Injectable()
export class ProduccionConsultaService {
  private readonly logger = new Logger(ProduccionConsultaService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async getFechasDisponibles(): Promise<FechaDisponibleDto[]> {
    const query = `
      SELECT DISTINCT 
        FECHA_DESDE AS "FECHA_DESDE", 
        FECHA_HASTA AS "FECHA_HASTA"
      FROM [003BDPRODUCCION].dbo.[PLAN_PRODUCCION]
      ORDER BY FECHA_DESDE, FECHA_HASTA;
    `;
    try {
      this.logger.log('Executing query for getFechasDisponibles');
      const result = await this.entityManager.query(query);
      return result as FechaDisponibleDto[];
    } catch (error) {
      this.logger.error('Error executing getFechasDisponibles query', error.stack);
      throw new InternalServerErrorException('Error al obtener las fechas disponibles de producción');
    }
  }

  async getDetallesPorFecha(consultaDto: ConsultaDetallesDto): Promise<ProduccionDetalleDto[]> {
    const { from, to } = consultaDto;
    const query = `
      SELECT 
        A.acodigo AS "acodigo", 
        B.adescri AS "adescri", 
        A.CANT_PROD AS "CANT_PROD", 
        A.FECHA_DESDE AS "FECHA_DESDE", 
        A.FECHA_HASTA AS "FECHA_HASTA"
      FROM [003BDPRODUCCION].dbo.[PLAN_PRODUCCION] A 
      INNER JOIN [003BDCOMUN].dbo.MAEART B ON A.ACODIGO = B.ACODIGO
      WHERE A.FECHA_DESDE >= @0 AND A.FECHA_HASTA <= @1
      ORDER BY A.FECHA_DESDE, A.acodigo;
    `;
    try {
      this.logger.log(`Executing query for getDetallesPorFecha with params: from=${from}, to=${to}`);
      const result = await this.entityManager.query(query, [from, to]);
      return result as ProduccionDetalleDto[];
    } catch (error) {
      this.logger.error(`Error executing getDetallesPorFecha query with params: from=${from}, to=${to}`, error.stack);
      throw new InternalServerErrorException('Error al obtener los detalles de producción por fecha');
    }
  }

  async getResumenProduccion(consultaDto: ConsultaDetallesDto): Promise<ProduccionResumenDto[]> {
    const { from, to } = consultaDto;
    const query = `
      SELECT
       B.ACODIGO AS CODIGO,
          ADESCRI AS DESCRIPCION,
          C.STSKDIS AS STOCK,
          SUM(E.CANT_PROD / PESO_NETO * CANTIDAD) AS 'CANTIDAD REQUERIDA',
          C.STSKDIS - SUM(E.CANT_PROD / PESO_NETO * CANTIDAD) AS DISPONIBLE,
          C.STSKMIN AS 'STOCK MINIMO'
        FROM
          [003BDPRODUCCION].[DBO].[RECETA_VERSIONES] A
          INNER JOIN [003BDPRODUCCION].[DBO].[RECETA_VERSIONES_DET] B ON A.CODIGO_VERSION = B.CODIGO_VERSION
          INNER JOIN [003BDCOMUN].[DBO].[STKART] C ON B.ACODIGO = STCODIGO
          INNER JOIN [003BDPRODUCCION].[DBO].[PLAN_PRODUCCION] E ON A.CODIGO_RECETA = E.ACODIGO
          INNER JOIN [003BDCOMUN].[DBO].[MAEART] F ON B.ACODIGO = F.ACODIGO
        WHERE
          STSKDIS >= 0
          AND ACTIVO = 0
          AND C.STALMA = '05'
          AND AESTADO = 'V'
          AND VERSION_RECETA = (SELECT MAX(VERSION_RECETA) FROM [003BDPRODUCCION].[DBO].RECETA_VERSIONES D WHERE A.CODIGO_RECETA = D.CODIGO_RECETA AND ACTIVO = 0)
          AND PESO_NETO >= 1
        AND E.FECHA_DESDE >= @0 
        AND E.FECHA_HASTA <= @1 
       GROUP BY
          ADESCRI,
          B.ACODIGO,
          C.STSKDIS,
          C.STSKMIN
        ORDER BY
          ADESCRI,
          B.ACODIGO;
    `;
    try {
      this.logger.log(`Executing query for getResumenProduccion with params: from=${from}, to=${to}`);
      const result = await this.entityManager.query(query, [from, to]);
      return result.map(item => ({
        ...item,
        STOCK: parseFloat(item.STOCK),
        CANTIDAD_REQUERIDA: parseFloat(item.CANTIDAD_REQUERIDA),
        DISPONIBLE: parseFloat(item.DISPONIBLE),
        STOCK_MINIMO: parseFloat(item.STOCK_MINIMO),
      })) as ProduccionResumenDto[];
    } catch (error) {
      this.logger.error(`Error executing getResumenProduccion query with params: from=${from}, to=${to}`, error.stack);
      throw new InternalServerErrorException('Error al obtener el resumen de producción');
    }
  }
}
