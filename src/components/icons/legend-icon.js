import React from 'react';
import cx from 'classnames';
import PipelineIcon from './pipeline';

const LegendIcon = ({ icon }) => {
  let Component = null;
  let classList = '';

  switch (icon) {
    case 'pipeline':
      classList = 'border-0.75 border-primary text-primary';
      Component = <PipelineIcon />;
      break;
    default:
      console.warn(`Unsupported icon:`, icon);
      Component = null;
      break;
  }

  return <div className={cx('flex w-6 h-6 rounded-full ', classList)}>{Component}</div>;
};

export default LegendIcon;
