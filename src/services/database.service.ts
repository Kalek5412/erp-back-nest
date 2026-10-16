import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class DatabaseService {

    constructor(
        @InjectConnection()
        private readonly defaultConnection: Connection,
        @InjectConnection('comunDb')
        private readonly comunConnection: Connection
    ) {}

    getDatabaseName(usuEmpresa: string): string {
        // Estricto por código: solo 002/003/004. Sin heurísticas por nombre.
        const raw = (usuEmpresa || '').toString().trim();
        // Normaliza a 3 dígitos si viene '3' -> '003'
        const code = raw.padStart(3, '0').match(/^(002|003|004|005)$/)?.[1];
        if (!code) {
            throw new Error(`Empresa inválida: "${usuEmpresa}". Se requiere código 002/003/004/005.`);
        }

        switch (code) {
            case '002':
                return '002BDCOMUN';
            case '003':
                return '003BDCOMUN';
            case '005':
                return '005BDCOMUN';
            case '004':
            default:
                return '004BDCOMUN';
        }
    }

    getConnection(usuEmpresa: string): Connection {
        return this.comunConnection;
    }

    async executeQuery(query: string, parameters: any[] = []): Promise<any> {
        return this.defaultConnection.query(query, parameters);
    }

    getProductionDatabaseName(usuEmpresa: string): string {
        switch (usuEmpresa) {
            case '002':
                return '002BDPRODUCCION';
            case '003':
                return '003BDPRODUCCION';
            case '004':
                return '004BDPRODUCCION';
            case '005':
                return '005BDPRODUCCION';
            default:
                return '004BDPRODUCCION';
        }
    }
} 