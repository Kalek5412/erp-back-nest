import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('USUARIO')
export class User {

    @PrimaryColumn({ name: 'USU_CODIGO', length: 10 })
    usuCodigo: string;

    // Composite PK with company code to support multi-empresa users
    @PrimaryColumn({ name: 'EMP_CODIGO', length: 15 })
    usuEmpresa: string;

    @Column({ name: 'USU_PASSWORD', length: 10 })
    usuPassword: string;

    @Column({ name: 'USU_NIVEL', length: 1 })
    usuNivel: string;

    @Column({ name: 'USU_NOMBRE', length: 32 })
    usuNombre: string;

    @Column({ name: 'COD_EMPRESA'})
    codEmpresa: string;
}
