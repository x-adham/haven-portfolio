/* Animated gold background — powered by GSAP + tsParticles */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  /* ---- GSAP: drifting orbs, rotating rings, sheen, scroll + mouse parallax ---- */
  if (window.gsap && !reduceMotion) {
    const g = window.gsap;
    const orbs = g.utils.toArray('.bg-orb');

    orbs.forEach((orb, i) => {
      g.to(orb, {
        x: () => g.utils.random(-12, 12) + 'vw',
        y: () => g.utils.random(-10, 10) + 'vh',
        scale: () => g.utils.random(0.85, 1.2),
        duration: g.utils.random(14, 22),
        ease: 'sine.inOut',
        repeat: -1, yoyo: true, repeatRefresh: true,
        delay: i * 1.5,
      });
    });

    g.to('.bg-ring--1', { rotation: 360, duration: 140, ease: 'none', repeat: -1 });
    g.to('.bg-ring--2', { rotation: -360, duration: 100, ease: 'none', repeat: -1 });

    g.fromTo('.bg-sheen', { xPercent: -60 }, {
      xPercent: 60, duration: 9, ease: 'power1.inOut', repeat: -1, repeatDelay: 5,
    });

    // fade the scene in
    g.from('.bg-scene', { opacity: 0, duration: 1.6, ease: 'power2.out' });

    // mouse parallax on the orb layer
    if (!isMobile) {
      const xTo = g.quickTo('.bg-orbs', 'x', { duration: 1.8, ease: 'power3.out' });
      const yTo = g.quickTo('.bg-orbs', 'y', { duration: 1.8, ease: 'power3.out' });
      window.addEventListener('mousemove', (e) => {
        xTo((e.clientX / window.innerWidth - 0.5) * -40);
        yTo((e.clientY / window.innerHeight - 0.5) * -40);
      }, { passive: true });
    }

    // scroll parallax
    if (window.ScrollTrigger) {
      g.registerPlugin(window.ScrollTrigger);
      g.to('.bg-rings', {
        rotation: 45, scale: 1.15, ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.2 },
      });
      g.to('#bgParticles', {
        yPercent: -8, ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.5 },
      });
    }
  }

  /* ---- tsParticles: floating gold dust with faint links ---- */
  if (window.tsParticles && window.loadSlim) {
    window.loadSlim(window.tsParticles).then(() => window.tsParticles.load({
      id: 'bgParticles',
      options: {
        fullScreen: { enable: false },
        background: { color: 'transparent' },
        fpsLimit: 60,
        detectRetina: true,
        particles: {
          number: { value: isMobile ? 35 : 80, density: { enable: true } },
          color: { value: ['#D4AF37', '#F3E5AB', '#B8860B', '#FFD970'] },
          shape: { type: 'circle' },
          opacity: {
            value: { min: 0.15, max: 0.8 },
            animation: { enable: !reduceMotion, speed: 0.6, sync: false },
          },
          size: {
            value: { min: 0.6, max: 2.6 },
            animation: { enable: !reduceMotion, speed: 1.5, sync: false },
          },
          links: {
            enable: !isMobile, distance: 140, color: '#D4AF37', opacity: 0.08, width: 1,
          },
          move: {
            enable: !reduceMotion, speed: 0.35, direction: 'top',
            random: true, straight: false, outModes: { default: 'out' },
          },
          shadow: { enable: true, color: '#D4AF37', blur: 6 },
        },
        interactivity: {
          detectsOn: 'window',
          events: {
            onHover: { enable: !isMobile && !reduceMotion, mode: 'grab' },
            resize: { enable: true },
          },
          modes: {
            grab: { distance: 170, links: { opacity: 0.25, color: '#F3E5AB' } },
          },
        },
      },
    })).catch(() => {});
  }
})();
