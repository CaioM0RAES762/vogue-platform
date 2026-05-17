import { IsInt, Min, Max } from 'class-validator';

export class UpdateItemDto {
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
