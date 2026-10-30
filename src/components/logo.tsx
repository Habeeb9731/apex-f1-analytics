import type { SVGProps } from "react";

// Brand mark: red upper stroke stays fixed; the lower stroke and checkers follow currentColor so it works in both themes.
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="40 140 1710 640" role="img" aria-label="APEX" {...props}>
      <path fill="#e10600" d="M58 735 L555 235 Q630 155 770 155 L1735 155 L1600 290 Q1560 330 1500 330 L790 330 Q720 330 670 380 L318 735 Z" />
      <g fill="currentColor">
        <path d="M355 763 L705 420 Q745 382 800 382 L1497 382 L1385 490 Q1345 530 1290 530 L885 530 Q835 530 795 572 L620 735 Q590 763 545 763 Z" />
        <path d="M1495 468 L1682 468 L1610 568 L1420 568 Z" />
        <path d="M1235 578 L1420 578 L1340 672 L1157 672 Z" />
        <path d="M1365 668 L1545 668 L1470 763 L1290 763 Z" />
      </g>
    </svg>
  );
}
