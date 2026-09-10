export const tasteTaxonomy = {
  fruit: {
    label: 'Фруктовий',
    aliases: ['фрукт', 'fruit'],
    near: ['sweet', 'citrus'],
    profiles: {
      cherry: { label: 'Вишня', aliases: ['вишн', 'cherry'] },
      peach: { label: 'Персик', aliases: ['персик', 'peach'] },
      mango: { label: 'Манго', aliases: ['манго', 'mango'] },
      apple: { label: 'Яблуко', aliases: ['яблук', 'яблок', 'apple'] },
      orange: { label: 'Апельсин', aliases: ['апельсин', 'orange'] },
      berries: { label: 'Ягоди', aliases: ['ягод', 'berries', 'berry'] },
      plum: { label: 'Слива', aliases: ['слив', 'plum'] },
      apricot: { label: 'Абрикос', aliases: ['абрикос', 'apricot'] },
    },
  },
  herbal: {
    label: 'Трав’яний',
    aliases: ['травян', 'трав’ян', 'трав\'ян', 'травяной', 'herbal'],
    near: ['garlic', 'citrus'],
    profiles: {
      herbs: { label: 'Трави', aliases: ['трав', 'зелень', 'herbs'] },
      rosemary: { label: 'Розмарин', aliases: ['розмарин', 'rosemary'] },
      basil: { label: 'Базилік', aliases: ['базил', 'basil'] },
      thyme: { label: 'Чебрець', aliases: ['чебрец', 'тимьян', 'thyme'] },
      oregano: { label: 'Орегано', aliases: ['орегано', 'oregano'] },
      dill: { label: 'Кріп', aliases: ['кріп', 'укроп', 'dill'] },
      parsley: { label: 'Петрушка', aliases: ['петруш', 'parsley'] },
    },
  },
  spicy: {
    label: 'Гострий',
    aliases: ['гостр', 'остр', 'пекуч', 'spicy', 'hot'],
    near: ['bbq', 'smoky'],
    profiles: {
      chili: { label: 'Чилі', aliases: ['чилі', 'чили', 'chili'] },
      pepper: { label: 'Перець', aliases: ['перц', 'переч', 'pepper'] },
    },
  },
  smoky: {
    label: 'Димний',
    aliases: ['димн', 'копчен', 'дымн', 'smoky', 'smoked'],
    near: ['bbq', 'spicy'],
    profiles: {
      smoke: { label: 'Дим', aliases: ['дим', 'дым', 'smoke'] },
      bbqSmoke: { label: 'Дим барбекю', aliases: ['дим барбекю', 'bbq smoke'] },
    },
  },
  sweet: {
    label: 'Солодкий',
    aliases: ['солод', 'слад', 'sweet'],
    near: ['fruit'],
    profiles: {
      honey: { label: 'Мед', aliases: ['мед', 'honey'] },
      caramel: { label: 'Карамель', aliases: ['карамел', 'caramel'] },
    },
  },
  garlic: {
    label: 'Часниковий',
    aliases: ['часник', 'часнич', 'чеснок', 'garlic'],
    near: ['herbal'],
    profiles: {
      garlic: { label: 'Часник', aliases: ['часник', 'часнич', 'чеснок', 'garlic'] },
    },
  },
  bbq: {
    label: 'Барбекю',
    aliases: ['барбекю', 'barbecue', 'bbq'],
    near: ['smoky', 'spicy'],
    profiles: {
      bbq: { label: 'Барбекю', aliases: ['барбекю', 'barbecue', 'bbq'] },
    },
  },
  curry: {
    label: 'Карі',
    aliases: ['карі', 'карри', 'curry'],
    near: ['spicy'],
    profiles: {
      curry: { label: 'Карі', aliases: ['карі', 'карри', 'curry'] },
    },
  },
  mustard: {
    label: 'Гірчичний',
    aliases: ['гірч', 'горчиц', 'mustard'],
    near: ['spicy', 'sweet'],
    profiles: {
      mustard: { label: 'Гірчиця', aliases: ['гірч', 'горчиц', 'mustard'] },
    },
  },
  citrus: {
    label: 'Цитрусовий',
    aliases: ['цитрус', 'citrus'],
    near: ['fruit', 'herbal'],
    profiles: {
      lemon: { label: 'Лимон', aliases: ['лимон', 'lemon'] },
      orange: { label: 'Апельсин', aliases: ['апельсин', 'orange'] },
    },
  },
};

export function resolveTasteIntent(text) {
  const normalized = text.toLocaleLowerCase('uk-UA');

  for (const [direction, category] of Object.entries(tasteTaxonomy)) {
    for (const [profile, details] of Object.entries(category.profiles)) {
      if (details.aliases.some((alias) => normalized.includes(alias))) {
        return {
          direction,
          directionLabel: category.label,
          profile,
          profileLabel: details.label,
        };
      }
    }
  }

  for (const [direction, category] of Object.entries(tasteTaxonomy)) {
    if (category.aliases.some((alias) => normalized.includes(alias))) {
      return { direction, directionLabel: category.label, profile: null, profileLabel: null };
    }
  }

  return null;
}

export function getTasteIntent(direction, profile = null) {
  const category = tasteTaxonomy[direction];
  if (!category) return null;
  const profileDetails = profile ? category.profiles[profile] : null;
  if (profile && !profileDetails) return null;
  return {
    direction,
    directionLabel: category.label,
    profile,
    profileLabel: profileDetails?.label || null,
  };
}

export function productTasteMatch(product, intent) {
  if (!intent) return { exact: true, near: false, exactProfile: false, exactDirection: false };
  const profiles = new Set(product.tasteProfiles || []);
  const exactProfile = Boolean(intent.profile && profiles.has(intent.profile));
  const directionProfiles = new Set(Object.keys(tasteTaxonomy[intent.direction]?.profiles || {}));
  const exactDirection = product.tasteDirection === intent.direction
    || [...profiles].some((profile) => directionProfiles.has(profile))
    || (intent.direction === 'sweet' && product.sweetness >= 3)
    || (intent.direction === 'spicy' && product.spiciness >= 3);
  const nearDirections = tasteTaxonomy[intent.direction]?.near || [];
  const near = nearDirections.includes(product.tasteDirection);

  return {
    exact: intent.profile ? exactProfile : exactDirection,
    near: intent.profile ? !exactProfile && exactDirection : near,
    exactProfile,
    exactDirection,
  };
}

export const tasteTaxonomyForPrompt = Object.fromEntries(
  Object.entries(tasteTaxonomy).map(([direction, category]) => [
    direction,
    {
      label: category.label,
      profiles: Object.entries(category.profiles).map(([profile, details]) => ({
        id: profile,
        label: details.label,
      })),
    },
  ]),
);
