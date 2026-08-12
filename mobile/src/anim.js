/* ------------------------------------------------------------------
   anim.js — motion primitives.

   Built on React Native's core Animated API so there is no extra
   dependency and nothing to configure in babel. Everything that moves
   uses transform/opacity, which run on the native driver and therefore
   stay smooth even while the CSP solver is busy on the JS thread.

   House rules: motion is short (150–320ms), always has a reason
   (something arrived, changed, or was touched), and never blocks input.
------------------------------------------------------------------- */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable } from 'react-native';

export const DUR = { fast: 150, base: 220, slow: 320 };

// Standard ease-out: quick to start, gentle to settle.
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/* ---------- entrance ---------- */

// Fades and lifts its children into place once, on mount.
// `delay` staggers list items; `from` sets the travel distance.
export function FadeIn({ children, delay = 0, from = 10, duration = DUR.base, style }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: EASE,
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [t, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Staggers a list of children so each caller need not do the delay maths.
export function Stagger({ children, step = 45, initialDelay = 0, from = 10 }) {
  const items = React.Children.toArray(children);
  return items.map((child, i) => (
    <FadeIn key={child.key || i} delay={initialDelay + i * step} from={from}>
      {child}
    </FadeIn>
  ));
}

/* ---------- touch feedback ---------- */

// Pressable that dips slightly when touched. Gives every tap a physical
// acknowledgement, which is most of what makes a UI feel "solid".
export function PressScale({ children, onPress, style, scaleTo = 0.97, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = value =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4
    }).start();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ---------- transitions ---------- */

// Fades the content in whenever `swapKey` changes — used for tab content.
// Children are rendered directly rather than held in state: keeping a copy
// would re-run on every parent render, since JSX children are a new object
// each time, and that turns into an endless render loop.
export function FadeSwap({ swapKey, children, style }) {
  const t = useRef(new Animated.Value(1)).current;
  const previous = useRef(swapKey);

  useEffect(() => {
    if (previous.current === swapKey) return;
    previous.current = swapKey;
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1, duration: DUR.base, easing: EASE, useNativeDriver: true
    }).start();
  }, [swapKey, t]);

  return (
    <Animated.View
      style={[
        { flex: 1 },
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Reveals a panel on open and unmounts it on close. Animating height
// would need the content measured first, which flashes the full-height
// content on the very first frame; fading the mount avoids that entirely.
export function Reveal({ open, children, from = 8 }) {
  if (!open) return null;
  return <FadeIn from={from} duration={DUR.base}>{children}</FadeIn>;
}

/* ---------- attention ---------- */

// Slow breathing loop, used while the solver is thinking.
export function Pulse({ children, active = true, style }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, t]);

  return (
    <Animated.View
      style={[style, { opacity: active ? t.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) : 1 }]}
    >
      {children}
    </Animated.View>
  );
}

// Small pop whenever the value changes — draws the eye to a new count.
export function Pop({ children, value, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: 110, easing: EASE, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 })
    ]).start();
  }, [value, scale]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/* ---------- numbers ---------- */

// Counts up to `value` so statistics land rather than blink into place.
export function CountUp({ value, duration = 600, style, format }) {
  const numeric = typeof value === 'number' && isFinite(value);
  const t = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(numeric ? 0 : value);

  useEffect(() => {
    if (!numeric) { setShown(value); return undefined; }
    t.setValue(0);
    const id = t.addListener(({ value: v }) => setShown(Math.round(v * value)));
    const animation = Animated.timing(t, {
      toValue: 1, duration, easing: EASE, useNativeDriver: false
    });
    animation.start();
    return () => { animation.stop(); t.removeListener(id); };
  }, [value, duration, numeric, t]);

  return <Animated.Text style={style}>{format && numeric ? format(shown) : String(shown)}</Animated.Text>;
}

/* ---------- modal sheet ---------- */

// Backdrop fade plus sheet slide-up. Mounted only while visible.
export function useSheetAnimation(visible) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, {
      toValue: visible ? 1 : 0,
      duration: visible ? DUR.slow : DUR.fast,
      easing: EASE,
      useNativeDriver: true
    }).start();
  }, [visible, t]);

  return useMemo(() => ({
    backdrop: { opacity: t },
    sheet: {
      opacity: t,
      transform: [
        { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
        { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }
      ]
    }
  }), [t]);
}
