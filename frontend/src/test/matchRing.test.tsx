import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MatchRing } from '../components/MatchRing';
import { stubMatchMedia } from './setup';

const SIZE = 80;
const FINAL_OFFSET = 2 * Math.PI * ((SIZE - 10) / 2) * (1 - 75 / 100);

function scoreCircle(container: HTMLElement): SVGCircleElement {
  return container.querySelector('.score-ring') as SVGCircleElement;
}

// Framer Motion also uses el.animate() for its own opacity, so look only at the ring's animation.
function ringAnimationCalls() {
  return vi.mocked(Element.prototype.animate).mock.calls.filter(([keyframes]) =>
    JSON.stringify(keyframes).includes('strokeDashoffset'),
  );
}

describe('MatchRing', () => {
  it('animates when motion is allowed', () => {
    render(<MatchRing score={75} size={SIZE} />);
    expect(ringAnimationCalls()).toHaveLength(1);
  });

  it('skips the animation and shows the final value under prefers-reduced-motion', () => {
    stubMatchMedia(true);
    const { container } = render(<MatchRing score={75} size={SIZE} />);
    expect(ringAnimationCalls()).toHaveLength(0);
    const shown = scoreCircle(container).getAttribute('stroke-dashoffset');
    expect(Number(shown)).toBeCloseTo(FINAL_OFFSET, 5);
  });
});
