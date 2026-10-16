import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('DETMOV')
export class DetalleMov {
    @PrimaryColumn({ name: 'SUBDIAR_CODIGO', length: 2 })
    subdiarCodigo: string = '04';

    @Column({ name: 'DMOV_C_COMPR', length: 4, nullable: true })
    dmovCCompr: string;

    @Column({ name: 'DMOV_SECUE', length: 5, nullable: true })
    dmovSecue: string;

    @Column({ name: 'DMOV_FECHA', type: 'smalldatetime', nullable: true })
    dmovFecha: Date | null;

    @Column({ name: 'DMOV_CUENT', type: 'numeric', nullable: true })
    dmovCuent: string | null;

    @Column({ name: 'DMOV_ANEXO',  type: 'varchar', length: 13, nullable: true })
    dmovAnexo: string | null;

    @Column({ name: 'DMOV_DOCUM',  type: 'varchar', length: 23, nullable: true })
    dmovDocum: string | null;

    @Column({ name: 'DMOV_FECDC', type: 'smalldatetime', nullable: true })
    dmovFecdc: Date | null;

    @Column({ name: 'DMOV_CENCO', type: 'numeric', nullable: true })
    dmovCenco: string | null;

    @Column({ name: 'DMOV_DEBE', type: 'numeric', precision: 20, scale: 2, nullable: true })
    dmovDebe: number | null;

    @Column({ name: 'DMOV_HABER', type: 'numeric', precision: 20, scale: 2, nullable: true })
    dmovHaber: number | null;

    @Column({ name: 'DMOV_DEBUS', type: 'numeric', precision: 20, scale: 2, nullable: true })
    dmovDebus: number | null;

    @Column({ name: 'DMOV_HABUS', type: 'numeric', precision: 20, scale: 2, nullable: true })
    dmovHabus: number | null;

    @Column({ name: 'DMOV_GLOSA', length: 60, nullable: true })
    dmovGlosa: string = 'IMPORTACION COMPRAS';

    @Column({ name: 'DMOV_L_COMPR', type: 'bit' })
    dmovLCompr: boolean = true;

    @Column({ name: 'DMOV_C_DESTI', length: 18, nullable: true })
    dmovCDesti: string = '';

    @Column({ name: 'DMOV_FECVEN', type: 'smalldatetime', nullable: true })
    dmovFecven: Date | null;

    @Column({ name: 'DINTERFACE', length: 2 })
    dinterface: string = '01';

    // Add monthPer as a transient property
    monthPer?: string;
}