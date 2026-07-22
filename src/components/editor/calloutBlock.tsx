import { defaultProps } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';

const CALLOUT_ICONS = {
  info: '💡',
  warning: '⚠️',
  success: '✅',
  error: '🚫',
} as const;

export const calloutBlock = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      ...defaultProps,
      calloutType: {
        default: 'info',
        values: ['info', 'warning', 'success', 'error'],
      } as const,
    },
    content: 'inline',
  },
  {
    render: (props) => {
      const calloutType = props.block.props.calloutType as keyof typeof CALLOUT_ICONS;
      return (
        <div className="callout-block" data-callout-type={calloutType}>
          <span className="callout-icon" contentEditable={false}>
            {CALLOUT_ICONS[calloutType]}
          </span>
          <div className="callout-content" ref={props.contentRef} />
        </div>
      );
    },
  },
);
