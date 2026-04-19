export const matchesPiNumberFieldName = (fieldName: string): boolean => {
  const normalizedName = fieldName.trim().toLowerCase().replace(/[\s_\-()（）]+/g, '');

  return normalizedName === 'pi号'
    || normalizedName === 'pi编号'
    || normalizedName === 'pinumber'
    || normalizedName === 'pino'
    || normalizedName === '✅pi';
};
