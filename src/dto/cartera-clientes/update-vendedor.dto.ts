import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateVendedorDto {
  @IsString()
  @IsNotEmpty()
  cdoCodVen: string;
} 