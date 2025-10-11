export const toTitleCase = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export function isFirstDivision(division) {
  return `${division}`.toLowerCase().includes('first');
}
