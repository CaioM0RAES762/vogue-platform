import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

export function validateCpf(rawCpf: string): boolean {
  const cpf = rawCpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (slice: string, factor: number): number => {
    const sum = slice.split('').reduce((acc, digit) => acc + Number(digit) * factor--, 0);
    const remainder = (sum * 10) % 11;
    return remainder >= 10 ? 0 : remainder;
  };

  const firstDigit = calcDigit(cpf.slice(0, 9), 10);
  if (firstDigit !== Number(cpf[9])) return false;

  const secondDigit = calcDigit(cpf.slice(0, 10), 11);
  return secondDigit === Number(cpf[10]);
}

@ValidatorConstraint({ name: 'IsCpf', async: false })
class IsCpfConstraint implements ValidatorConstraintInterface {
  validate(cpf: string) {
    return validateCpf(cpf);
  }
  defaultMessage() {
    return 'CPF inválido';
  }
}

export function IsCpf(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCpfConstraint,
    });
  };
}
