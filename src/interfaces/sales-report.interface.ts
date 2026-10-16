export interface SalesReportItem {
    vendedor: string;
    pedido: string;
    cantidad: number;
    pendiente: number;
    precioSinIgv: number;
    ventaSinIgv: number;
    costo: number;
    margen: number;
    margenPor: number;
}
