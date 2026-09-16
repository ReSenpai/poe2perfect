import { obj, objs, str } from '@/lib/data/coerce';
import type { QuestAct } from './model';

/** `questRewards.quests[]`: each quest with the reward the author picked (null when none). */
export function parseQuestRewards(raw: unknown): QuestAct[] {
  const acts = new Map<string, QuestAct>();
  for (const entry of objs(obj(raw)?.quests)) {
    const quest = obj(entry.quest);
    const act = str(quest?.act);
    const name = str(quest?.name);
    const reward = str(obj(entry.reward)?.bakedDescription);
    if (!quest || !act || !name || !reward) continue;

    if (!acts.has(act)) acts.set(act, { act, quests: [] });
    const choices = Array.isArray(quest.rewards) ? quest.rewards.length : 0;
    acts.get(act)!.quests.push({ name, area: str(quest.area), reward, isChoice: choices > 1 });
  }
  return [...acts.values()];
}
