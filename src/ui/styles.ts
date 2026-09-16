import buildCss from './build/build.css?inline';
import gearCss from './gear/gear.css?inline';
import passivesCss from './passives/passives.css?inline';
import progressionCss from './progression/progression.css?inline';
import richTextCss from './rich-text/rich-text.css?inline';
import skillsCss from './skills/skills.css?inline';
import tokensCss from './theme/tokens.css?inline';
import tooltipCss from './tooltip/tooltip.css?inline';

/** Base CSS for every shadow-root UI, bundled as text so no stylesheet has to be fetched at runtime. */
export const BASE_CSS = [tokensCss, richTextCss, buildCss, gearCss, skillsCss, passivesCss, progressionCss, tooltipCss].join('\n');
