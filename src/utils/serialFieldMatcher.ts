const normalizeSerialFieldName = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s._\\/-]+/g, '');

const EXACT_SERIAL_FIELD_NAMES = [
  '所属询盘流水号',
  '流水号',
  'serialno',
].map(normalizeSerialFieldName);

const FUZZY_SERIAL_FIELD_NAMES = [
  '所属询盘流水号',
  '流水号',
].map(normalizeSerialFieldName);

export const matchesSerialFieldName = (fieldName: string): boolean => {
  const normalizedFieldName = normalizeSerialFieldName(fieldName);

  return EXACT_SERIAL_FIELD_NAMES.includes(normalizedFieldName)
    || FUZZY_SERIAL_FIELD_NAMES.some(keyword => normalizedFieldName.includes(keyword));
};

export const findSerialFieldInList = <T extends { name: string }>(fields: T[]): T | undefined => {
  for (const exactFieldName of EXACT_SERIAL_FIELD_NAMES) {
    const exactMatchedField = fields.find(field => normalizeSerialFieldName(field.name) === exactFieldName);
    if (exactMatchedField) {
      return exactMatchedField;
    }
  }

  for (const fuzzyFieldName of FUZZY_SERIAL_FIELD_NAMES) {
    const fuzzyMatchedField = fields.find(field => normalizeSerialFieldName(field.name).includes(fuzzyFieldName));
    if (fuzzyMatchedField) {
      return fuzzyMatchedField;
    }
  }

  return undefined;
};
