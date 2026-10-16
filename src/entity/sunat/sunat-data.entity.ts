import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('CABMOV')
export class SunatData {    
    @PrimaryColumn({ name: 'SUBDIAR_CODIGO', type: 'varchar', length: 2 })
    subdiarCodigo: string = '04';

    @Column({ name: 'CMOV_C_COMPR', type: 'varchar', length: 4 })
    cmovCCompr: string;

    @Column({ name: 'CMOV_FECHA', type: 'smalldatetime', nullable: true })
    cmovFecha: Date | null;

    @Column({ name: 'CMOV_GLOSA', type: 'varchar', length: 60, nullable: true })
    cmovGlosa: string = 'IMPORTACION COMPRAS';

    @Column({ name: 'CMOV_MONED', type: 'varchar', length: 2, nullable: true })
    cmovMoned: string | null;    
    
    @Column({ name: 'CMOV_CONVE', type: 'varchar', length: 3, nullable: true })
    cmovConve: string = 'VTA';

    @Column({ name: 'CMOV_CAMES', type: 'numeric', precision: 20, scale: 9, nullable: true })
    cmovCames: number | null;

    @Column({ name: 'CMOV_FECCA', type: 'smalldatetime', nullable: true })
    cmovFecca: Date | null;

    @Column({ name: 'CMOV_TIPCA', type: 'numeric', precision: 20, scale: 9, nullable: true })
    cmovTipca: number | null;

    @Column({ name: 'CMOV_DEBE', type: 'numeric', precision: 20, scale: 2, nullable: true })
    cmovDebe: number | null;

    @Column({ name: 'CMOV_HABER', type: 'numeric', precision: 20, scale: 2, nullable: true })
    cmovHaber: number | null;

    @Column({ name: 'CMOV_DEBUS', type: 'numeric', precision: 20, scale: 2, nullable: true })
    cmovDebus: number | null;

    @Column({ name: 'CMOV_HABUS', type: 'numeric', precision: 20, scale: 2, nullable: true })
    cmovHabus: number | null;

    @Column({ name: 'CMOV_L_COMPR', type: 'bit' })
    cmovLCompr: boolean = true;

    @Column({ name: 'FECH_VCTO', type: 'smalldatetime', nullable: true })
    fechVcto: Date | null;    
    
    @Column({ name: 'CINTERFACE', type: 'varchar', length: 2 })
    cinterface: string = '01';

    @Column({ name: 'C_USUARIO', type: 'varchar', length: 9, nullable: true })
    cUsuario: string | null;

    // Additional fields to store original data
    @Column({ name: 'MONEDA', type: 'varchar', length: 2, nullable: true })
    moneda: string | null;

    @Column({ name: 'TIPO_CAMBIO', type: 'numeric', precision: 20, scale: 9, nullable: true })
    tipoCambio: number | null;

    @Column({ name: 'FECHA_EMISION', type: 'smalldatetime', nullable: true })
    fechaEmision: Date | null;

    @Column({ name: 'FECHA_VCTO_PAGO', type: 'smalldatetime', nullable: true })
    fechaVctoPago: Date | null;

    @Column({ name: 'TOTAL_CP', type: 'numeric', precision: 20, scale: 2, nullable: true })
    totalCp: number | null;

    @Column({ name: 'TOTAL_CP_ME', type: 'numeric', precision: 20, scale: 2, nullable: true })
    totalCpME: number | null;    
    
    // Additional fields needed for DETMOV calculations
    @Column({ name: 'CTA_CONTABLE', type: 'varchar', length: 18, nullable: true })
    ctaContable: string | null;

    @Column({ name: 'NRO_DOC_IDENTIDAD', type: 'varchar', length: 15, nullable: true })
    nroDocIdentidad: string | null;

    @Column({ name: 'CENTRO_COSTO', type: 'varchar', length: 10, nullable: true })
    centroCosto: string | null;

    @Column({ name: 'BI_GRAVADO_DG', type: 'numeric', precision: 20, scale: 2, nullable: true })
    biGravadoDg: number | null;

    @Column({ name: 'IGV_IPM_DG', type: 'numeric', precision: 20, scale: 2, nullable: true })
    igvIpmDg: number | null;    
    
    @Column({ name: 'TIPO_CP_DOC', type: 'varchar', length: 2, nullable: true })
    tipoCpDoc: string | null;

    @Column({ name: 'SERIE_CDP', type: 'varchar', length: 4, nullable: true })
    serieCdp: string | null;

    @Column({ name: 'NRO_CP_INICIAL', type: 'varchar', length: 8, nullable: true })
    nroCpInicial: string | null;
}