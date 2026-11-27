import { isToolId } from '../tools/index.ts';
import { TOOLS } from './copy.ts';
import { INFO, PRIVATE } from './copy-info.ts';

/** Fills each How this works panel on the page: its lines, then what stays private on this tool. */
export function fillInfo(root: ParentNode): void {
    for (const body of root.querySelectorAll<HTMLElement>('[data-info]')) {
        const id = body.dataset.info ?? '';
        if (!isToolId(id) || body.childElementCount > 0) continue;
        const list = document.createElement('ul');
        list.className = 'info__list';
        for (const point of INFO[id]) {
            const item = document.createElement('li');
            item.textContent = point;
            list.append(item);
        }
        const privacy = document.createElement('p');
        privacy.className = 'info__private';
        privacy.textContent = `${PRIVATE} ${TOOLS[id].privacy}`;
        body.replaceChildren(list, privacy);
    }
}
