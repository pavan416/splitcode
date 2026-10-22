import React from 'react';

const ICONS = {
  plus: ['M12 5v14','M5 12h14'],
  'plus-lg': ['M12 5v14','M5 12h14'],
  search: ['M11 18a7 7 0 1 1 0-14a7 7 0 0 1 0 14Z','m20 20-4.2-4.2'],
  'code-square': ['M9 9 5.5 12 9 15','M15 9 18.5 12 15 15','M13.5 5 10.5 19'],
  'code-slash': ['M9 9 5.5 12 9 15','M15 9 18.5 12 15 15','M13.5 5 10.5 19'],
  'folder2-open': ['M3 8.5h5l2 2h11v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z','M3 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1.5'],
  folder2: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  'folder-plus': ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z','M12 10v6','M9 13h6'],
  download: ['M12 4v10','m8-4-8 8-8-8','M5 20h14'],
  'three-dots': ['M12 5.5a.75.75 0 1 1 0 1.5a.75.75 0 0 1 0-1.5Zm0 5.75a.75.75 0 1 1 0 1.5a.75.75 0 0 1 0-1.5Zm0 5.75a.75.75 0 1 1 0 1.5a.75.75 0 0 1 0-1.5Z'],
  floppy: ['M5 4h11l3 3v13H5z','M8 4v5h7V4','M8 20v-6h8v6'],
  house: ['M4 10.5 12 4l8 6.5','M6.5 9.5V20h11V9.5'],
  trash3: ['M4 7h16','M9 7V4h6v3','M7 7l1 13h8l1-13','M10 11v5','M14 11v5'],
  stars: ['M12 4.5 13.2 7.8 16.5 9 13.2 10.2 12 13.5 10.8 10.2 7.5 9 10.8 7.8Z','M18.5 4.5v3','M17 6h3','M5.5 14.5v3','M4 16h3'],
  grid: ['M5 5h5v5H5z','M14 5h5v5h-5z','M5 14h5v5H5z','M14 14h5v5h-5z'],
  'x-lg': ['M6 6l12 12','M18 6 6 18'],
  x: ['M7 7l10 10','M17 7 7 17'],
  'arrow-left': ['M19 12H5','m11-7-7 7 7 7'],
  'arrow-right': ['M5 12h14','m8-7 7 7-7 7'],
  'arrow-up-right': ['M8 16 16 8','M10 8h6v6'],
  eraser: ['m6 16 6-6 6 6-4 4H6z','M10 8 8 6a2 2 0 0 1 3-3l7 7a2 2 0 1 1-3 3z'],
  'shield-check': ['M12 3 5 6v5c0 5 3.2 8.6 7 10 3.8-1.4 7-5 7-10V6z','m9.5 12 1.8 1.8 3.7-4'],
  cpu: ['M9 9h6v6H9z','M12 1v3','M12 20v3','M4.2 4.2l2.1 2.1','M17.7 17.7l2.1 2.1','M1 12h3','M20 12h3','M4.2 19.8l2.1-2.1','M17.7 6.3l2.1-2.1'],
  'filetype-html': ['M7 3.5h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z','M15 3.5v4h4','M8 10v6','M12 10v6','M8 13h4','M16 10h-2.5v6H16'],
  'filetype-css': ['M7 3.5h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z','M15 3.5v4h4','M15.5 11a2 2 0 1 0 0 4','M10.5 11a2 2 0 1 0 0 4','M13 13h-1'],
  'filetype-js': ['M7 3.5h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z','M15 3.5v4h4','M10 10v5a1.5 1.5 0 0 1-3 0','M15.5 11c-.5-.6-2-.7-2.5 0-.6.8.1 1.5 1.1 1.8 1.4.4 2 1 1.4 2-.5.8-2.3.9-3 .1'],
  'file-earmark-code': ['M7 3.5h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z','M15 3.5v4h4','m10 11-2 2 2 2','m14 11 2 2-2 2'],
  braces: ['M10 4C8.7 4 8 4.7 8 6v2c0 1.3-.7 2-2 2 1.3 0 2 .7 2 2v2c0 1.3.7 2 2 2','M14 4c1.3 0 2 .7 2 2v2c0 1.3.7 2 2 2-1.3 0-2 .7-2 2v2c0 1.3-.7 2-2 2'],
  markdown: ['M5 5h14v14H5z','M8 15V9l2 3 2-3v6','M15 15v-6l2 2'],
  'filetype-svg': ['M7 3.5h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z','M15 3.5v4h4','M9 14c2.5-5 4.5 5 7 0'],
  pencil: ['M4 20h4l10.5-10.5-4-4L4 16z','m12-10 4 4'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z','M12 9.5A2.5 2.5 0 1 0 12 14.5 2.5 2.5 0 0 0 12 9.5Z'],
  'play-circle': ['M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z','m10 9 6 3-6 3z'],
  display: ['M4 6h16v10H4z','M9 19h6','M12 16v3'],
  tablet: ['M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z','M11 18h2'],
  phone: ['M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z','M11 18h2'],
  'arrow-clockwise': ['M20 12a8 8 0 1 1-2.34-5.66','M20 4v5h-5'],
  terminal: ['M5 7.5 9.5 12 5 16.5','M11 17h8'],
  'file-earmark-zip': ['M7 3.5h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z','M15 3.5v4h4','M11 9h2','M11 12h2','M11 15h2','M11 18h2'],
  window: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z','M3 9h18'],
  lock: ['M7 11V8a5 5 0 1 1 10 0v3','M6 11h12v9H6z'],
  'info-circle': ['M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z','M12 10v6','M12 7.5h.01'],
  'check-circle-fill': ['M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z','m8.7 12 2.2 2.2 4.4-5'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-right': ['m9 6 6 6-6 6'],
  image: ['M4 6h16v12H4z','m7 14 3-3 4 4 2-2 2 2','M9 10h.01'],
  'file-earmark-binary': ['M7 3.5h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z','M15 3.5v4h4','M10 11h4','M10 15h4'],
  'box-arrow-up-right': ['M10 14 18 6','M13 6h5v5','M18 13v5H6V6h5'],
  copy: ['M9 9h10v12H9z','M5 3h10v12'],
  'diagram-3': ['M12 6v4','M7 18v-4','M17 18v-4','M7 14h10','M9 4h6v4H9z','M4 18h6v4H4z','M14 18h6v4h-6z']
};

export default function AppIcon({ name, size = 18, strokeWidth = 1.6, className = '', ...rest }) {
  const paths = ICONS[name] || ICONS['info-circle'];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`scIcon ${className}`.trim()}
      {...rest}
    >
      {paths.map((d, index) => <path key={`${name}-${index}`} d={d} />)}
    </svg>
  );
}
