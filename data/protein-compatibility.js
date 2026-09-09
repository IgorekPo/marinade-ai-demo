export const proteinGroups = {
  poultry: {
    label: 'птиця',
    catalogMeat: 'chicken',
    proteins: [
      { id: 'chicken', label: 'курка', genitive: 'курки', aliases: ['курк', 'куряч', 'куриц', 'цыпл'] },
      { id: 'turkey', label: 'індичка', genitive: 'індички', aliases: ['індич', 'индич', 'индей', 'индюш'] },
      { id: 'duck', label: 'качка', genitive: 'качки', aliases: ['качк', 'утк'] },
      { id: 'goose', label: 'гуска', genitive: 'гуски', aliases: ['гуск', 'гусин'] },
      { id: 'quail', label: 'перепілка', genitive: 'перепілки', aliases: ['перепіл', 'перепел'] },
      { id: 'other_poultry', label: 'інша птиця', genitive: 'іншої птиці', aliases: ['птиц', 'птах'] },
    ],
  },
  redMeat: {
    label: 'червоне м’ясо',
    catalogMeat: 'pork',
    proteins: [
      { id: 'pork', label: 'свинина', genitive: 'свинини', aliases: ['свинин', 'свиняч'] },
      { id: 'beef', label: 'яловичина', genitive: 'яловичини', aliases: ['ялович', 'говядин', 'говяж'] },
      { id: 'veal', label: 'телятина', genitive: 'телятини', aliases: ['телят', 'теляч'] },
      { id: 'lamb', label: 'ягнятина', genitive: 'ягнятини', aliases: ['ягнят', 'ягнен'] },
      { id: 'mutton', label: 'баранина', genitive: 'баранини', aliases: ['баранин', 'бараняч'] },
      { id: 'other_red_meat', label: 'інше червоне м’ясо', genitive: 'іншого червоного м’яса', aliases: ['червоне мясо', 'красное мясо'] },
    ],
  },
  fish: {
    label: 'риба',
    catalogMeat: 'fish',
    proteins: [
      { id: 'fish', label: 'риба', genitive: 'риби', aliases: ['риб', 'рыб'] },
      { id: 'salmon', label: 'лосось', genitive: 'лосося', aliases: ['лосос', 'семг'] },
      { id: 'trout', label: 'форель', genitive: 'форелі', aliases: ['форел'] },
      { id: 'tuna', label: 'тунець', genitive: 'тунця', aliases: ['тунц', 'тунец'] },
      { id: 'mackerel', label: 'скумбрія', genitive: 'скумбрії', aliases: ['скумбр'] },
      { id: 'dorado', label: 'дорадо', genitive: 'дорадо', aliases: ['дорад'] },
      { id: 'hake', label: 'хек', genitive: 'хека', aliases: ['хек'] },
      { id: 'cod', label: 'тріска', genitive: 'тріски', aliases: ['тріск', 'треск'] },
      { id: 'carp', label: 'короп', genitive: 'коропа', aliases: ['короп', 'карп'] },
      { id: 'zander', label: 'судак', genitive: 'судака', aliases: ['судак'] },
    ],
  },
};

export function resolveProteinIntent(text) {
  const normalized = text.toLocaleLowerCase('uk-UA');

  for (const [groupId, group] of Object.entries(proteinGroups)) {
    for (const protein of group.proteins) {
      if (protein.aliases.some((alias) => normalized.includes(alias))) {
        return {
          protein: protein.id,
          proteinLabel: protein.label,
          proteinGenitive: protein.genitive,
          proteinGroup: groupId,
          proteinGroupLabel: group.label,
          catalogMeat: group.catalogMeat,
          isExactCatalogProtein: protein.id === group.catalogMeat || groupId === 'fish',
        };
      }
    }
  }

  return null;
}

export function getProteinIntentById(proteinId) {
  for (const [groupId, group] of Object.entries(proteinGroups)) {
    const protein = group.proteins.find(({ id }) => id === proteinId);
    if (protein) {
      return {
        protein: protein.id,
        proteinLabel: protein.label,
        proteinGenitive: protein.genitive,
        proteinGroup: groupId,
        proteinGroupLabel: group.label,
        catalogMeat: group.catalogMeat,
        isExactCatalogProtein: protein.id === group.catalogMeat || groupId === 'fish',
      };
    }
  }

  return null;
}

export function productProteinScore(product, intent) {
  if (!intent) return 0;
  if (product.meat === intent.protein) return 24;
  if (product.compatibleWith?.includes(intent.protein)) return 20;
  if (product.proteinGroups?.includes(intent.proteinGroup)) return 18;
  if (product.meat === intent.catalogMeat) return intent.isExactCatalogProtein ? 24 : 16;
  return -24;
}

export const proteinGroupsForPrompt = Object.fromEntries(
  Object.entries(proteinGroups).map(([groupId, group]) => [
    groupId,
    {
      label: group.label,
      catalogFallback: group.catalogMeat,
      proteins: group.proteins.map(({ id, label }) => ({ id, label })),
    },
  ]),
);
