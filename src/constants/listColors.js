/**
 * Tailwind background classes shared with FE `BACKGROUND_COLORS`.
 * Used when materializing AI / seeded template lists onto boards.
 */
const LIST_BACKGROUND_COLORS = [
  "bg-green-500",
  "bg-blue-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-gray-500",
];

function pickListColor(index, preferred) {
  if (preferred && LIST_BACKGROUND_COLORS.includes(preferred)) {
    return preferred;
  }
  return LIST_BACKGROUND_COLORS[index % LIST_BACKGROUND_COLORS.length];
}

module.exports = {
  LIST_BACKGROUND_COLORS,
  pickListColor,
};
