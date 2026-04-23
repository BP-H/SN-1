// src/types/model-viewer.d.ts
import type { ModelViewerElement } from '@google/model-viewer';
import type { CSSProperties, ReactEventHandler } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': Omit<Partial<ModelViewerElement>, 'style' | 'onload'> & {
        style?: CSSProperties;
        onLoad?: ReactEventHandler<ModelViewerElement>;
      };
    }
  }
}

export {};
