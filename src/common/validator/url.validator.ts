import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'URL', async: false })
export class URLValidator implements ValidatorConstraintInterface {
  validate(value: string[], args: ValidationArguments) {
    const Regex =
      /[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;
    for (const item of value) {
      if (!Regex.test(item)) return false;
    }
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    // Default validation error message
    return `One or more URLs are invalid!`;
  }
}
