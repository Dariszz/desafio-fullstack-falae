import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 'review-order-123', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, { message: 'external_id não pode conter apenas espaços.' })
  external_id!: string;

  @ApiProperty({ example: 'company-456', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, { message: 'company_id não pode conter apenas espaços.' })
  company_id!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({
    example: 'O pedido demorou muito e chegou frio.',
    minLength: 3,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  @Matches(/\S/, { message: 'comment não pode conter apenas espaços.' })
  comment!: string;
}
