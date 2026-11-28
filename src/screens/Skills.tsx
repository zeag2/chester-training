import { useEffect, useState } from 'react';
import { useStore } from '../db/store';
import { ScreenHeader } from '../ui/ScreenHeader';
import { back } from '../ui/router';
import { Segmented, rememberedView, rememberView, segPanelId, segTabId, showViewInAddress } from '../ui/Segmented';
import { TreeView } from './Tree';
import { SkillList } from './Library';

export type SkillsView = 'tree' | 'list';
export const SKILLS_VIEWS = [['tree', 'Tree'], ['list', 'List']] as const;
const VIEW_KEY = 'paldex-skills-view';

/** Skills (`#/skills`, `#/skills/tree`, `#/skills/list`; UX review 2026-11-25, item 5): the skill tree and the list
    (search and branch chips, was the Library) as two views of one screen. The Trophy case stays its own screen.
    `redirect`: opened from an old address (`#/tree`, `#/library`), which is swapped for the new one. */
export function Skills({ view: viewProp, redirect }: { view?: SkillsView; redirect?: boolean }) {
  const { cat } = useStore();
  const [view, setView] = useState<SkillsView>(() => viewProp ?? rememberedView(VIEW_KEY, SKILLS_VIEWS.map(([v]) => v), 'tree'));
  useEffect(() => { rememberView(VIEW_KEY, view); }, [view]);
  useEffect(() => { if (redirect) showViewInAddress('skills/' + view); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (v: SkillsView) => { setView(v); showViewInAddress('skills/' + v); };
  if (!cat) return null;
  return <div className="screen">
    <ScreenHeader onBack={() => back('chester')} title={`${cat.name}’s skills`} />
    <Segmented label="Skills" idBase="skills" options={SKILLS_VIEWS} value={view} onChange={pick} style={{ marginTop: 'var(--sp-3)' }} />
    <div role="tabpanel" id={segPanelId('skills')} aria-labelledby={segTabId('skills', view)} data-view={view}>
      {view === 'tree' ? <TreeView /> : <SkillList />}
    </div>
  </div>;
}
