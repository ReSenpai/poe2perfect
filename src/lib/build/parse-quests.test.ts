import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../../tests/fixtures/load';
import { parseBuild } from './parse-build';
import { parseQuestRewards } from './parse-quests';

const build = (slug: Parameters<typeof loadFixture>[0]) => {
  const fixture = loadFixture(slug);
  return parseBuild(fixture.build, fixture.staticData);
};

describe('parseQuestRewards', () => {
  it('groups the rewards the author took by act, in the order the acts first come up', () => {
    const acts = build('chaos-dot-lich-starter-deadrabbit').questRewards;

    expect(acts.map((act) => act.act)).toEqual(['Act 2', 'Act 3', 'Act 4', 'Interlude']);
    expect(acts[2]!.quests.map((quest) => quest.name)).toEqual(["Tawhoa's Test", 'Goddess of Justice', "Tasalio's Test", "Ngamahu's Test"]);
    expect(acts[0]!.quests[0]).toEqual({
      name: 'Medallion',
      area: 'Valley of the Titans',
      reward: '30% increased Charm Charges gained, +1 Charm Slot',
      isChoice: true,
    });
  });

  it('leaves out quests without a reward picked', () => {
    const acts = build('chaos-dot-lich-starter-deadrabbit').questRewards;

    expect(acts.flatMap((act) => act.quests)).toHaveLength(7);
  });

  it('tells fixed rewards from rewards the player chooses', () => {
    const act1 = build('dreamcore-gas-grenade-pathfinder').questRewards[0]!;

    expect(act1.quests.find((quest) => quest.name === 'Beira of the Rotten Pack')).toMatchObject({ reward: '+10% to Cold Resistance', isChoice: false });
  });

  it('copes with missing or malformed data', () => {
    expect(parseQuestRewards(null)).toEqual([]);
    expect(parseQuestRewards({ quests: [{ quest: null, reward: { bakedDescription: 'x' } }, { quest: { name: 'Q', act: 'Act 1' }, reward: {} }] })).toEqual([]);
  });
});
