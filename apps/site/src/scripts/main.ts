import { gsap } from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, DrawSVGPlugin)

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel))

const mm = gsap.matchMedia()

mm.add('(prefers-reduced-motion: no-preference)', () => {
  ScrollSmoother.create({ smooth: 1.1, effects: false, normalizeScroll: false })

  masthead()
  chisel()
  clause()
  strata()
  trace()
  decisions()
})

// Reduced motion: everything is already in its final state in the markup,
// except the scripted parts of chapter I, which get their end state here.
mm.add('(prefers-reduced-motion: reduce)', () => {
  for (const row of $$('.tablet__row[data-org="globex"]')) row.style.opacity = '0.35'
  $('[data-count]').textContent = '3'
  $('[data-scope-text]').innerHTML = "app.org_id = <b>'acme'</b>"
  $('[data-verdict]').textContent = 'Unset the tenant and the answer is zero rows, not all of them.'
})

/** Out of the way while reading down, back as soon as the reader turns around. */
function masthead() {
  const bar = $('.masthead')
  const hide = gsap.to(bar, { yPercent: -100, duration: 0.45, ease: 'power3.inOut', paused: true })
  ScrollTrigger.create({
    start: 120,
    end: 'max',
    onUpdate: ({ direction }) => (direction === 1 ? hide.play() : hide.reverse()),
    onLeaveBack: () => hide.reverse(),
  })
}

/**
 * The hero word is cut letter by letter: each glyph opens from a horizontal
 * scribe line, throws a little stone dust, then the incision takes its
 * minium paint the way Roman lettering was rubricated.
 */
function chisel() {
  const word = $('[data-chisel]')
  const split = SplitText.create(word, { type: 'chars', charsClass: 'char' })
  const order = gsap.utils.shuffle([...split.chars]) as HTMLElement[]

  const tl = gsap.timeline({ delay: 0.25 })
  tl.set(word, { autoAlpha: 1 })

  order.forEach((char, i) => {
    const at = 0.18 + i * 0.16
    tl.fromTo(
      char,
      { clipPath: 'inset(49% 0% 49% 0%)', x: gsap.utils.random(-6, 6) },
      { clipPath: 'inset(0% 0% 0% 0%)', x: 0, duration: 0.55, ease: 'expo.out' },
      at,
    )
    tl.add(() => dust(char), at + 0.04)
  })

  tl.to(
    split.chars,
    {
      color: '#b5361c',
      duration: 1.4,
      ease: 'power2.inOut',
      stagger: { each: 0.06, from: 'start' },
    },
    '+=0.15',
  )

  const inscription = $('[data-inscription]')
  tl.from(inscription, { clipPath: 'inset(0 100% 0 0)', duration: 1.6, ease: 'power3.inOut' }, 0.9)
  tl.from(
    '[data-rise]',
    { y: 28, autoAlpha: 0, duration: 1, ease: 'power3.out', stagger: 0.12 },
    1.4,
  )
}

function dust(char: HTMLElement) {
  const box = char.getBoundingClientRect()
  for (let n = 0; n < 7; n++) {
    const grain = document.createElement('span')
    grain.className = 'dust'
    char.appendChild(grain)
    gsap.set(grain, { left: gsap.utils.random(0.2, 0.8) * box.width, top: box.height * 0.5 })
    gsap.to(grain, {
      x: gsap.utils.random(-60, 60),
      y: gsap.utils.random(-30, 90),
      rotation: gsap.utils.random(-180, 180),
      scale: gsap.utils.random(0.4, 1.4),
      autoAlpha: 0,
      duration: gsap.utils.random(0.6, 1.1),
      ease: 'power2.out',
      onComplete: () => grain.remove(),
    })
  }
}

/**
 * Chapter I, pinned and scrubbed: the same unfiltered query run three times,
 * with no tenant, with acme, then unset again.
 */
function clause() {
  const root = $('[data-clause]')
  const rows = $$('.tablet__row', root)
  const own = rows.filter((r) => r.dataset.org === 'acme')
  const foreign = rows.filter((r) => r.dataset.org === 'globex')
  const strike = (set: HTMLElement[]) => set.map((r) => $('.tablet__strike path', r))
  const count = $('[data-count]', root)
  const scope = $('[data-scope]', root)
  const scopeText = $('[data-scope-text]', root)
  const verdict = $('[data-verdict]', root)

  const counter = { n: 6 }
  const showCount = () => {
    count.textContent = String(Math.round(counter.n))
  }
  const say = (text: string) => () => {
    verdict.textContent = text
    gsap.fromTo(verdict, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5 })
  }

  gsap.set(strike(rows), { drawSVG: '0%' })

  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger: root, start: 'top top', end: '+=260%', pin: true, scrub: 0.8 },
  })

  tl.from(rows, { y: 24, autoAlpha: 0, stagger: 0.08, duration: 0.6 })
    .call(say('Without a guard, an unfiltered query reads every tenant.'), [], 0.7)
    .to(scope, { backgroundColor: 'rgb(181 54 28 / 0.18)', duration: 0.3 }, 1.2)
    .call(
      () => {
        scopeText.innerHTML = "app.org_id = <b>'acme'</b>"
      },
      [],
      1.25,
    )
    .call(say('Scoped to acme. Same query, same code.'), [], 1.3)
    .to(strike(foreign), { drawSVG: '100%', duration: 0.7, stagger: 0.12 }, 1.4)
    .to(foreign, { opacity: 0.32, y: 6, duration: 0.5, stagger: 0.08 }, 1.9)
    .to(counter, { n: 3, duration: 0.6, onUpdate: showCount, ease: 'steps(3)' }, 1.9)
    .to(scope, { backgroundColor: 'rgb(181 54 28 / 0)', duration: 0.3 }, 2.8)
    .call(
      () => {
        scopeText.innerHTML = 'app.org_id = <b>unset</b>'
      },
      [],
      2.85,
    )
    .call(say('Forget the scope and the answer is zero rows, not all of them.'), [], 2.9)
    .to(strike(own), { drawSVG: '100%', duration: 0.6, stagger: 0.1 }, 2.95)
    .to(own, { opacity: 0.32, y: 6, duration: 0.5, stagger: 0.08 }, 3.1)
    .to(counter, { n: 0, duration: 0.6, onUpdate: showCount, ease: 'steps(3)' }, 3)
    .to({}, { duration: 0.6 })
}

/**
 * Chapter II: courses are dropped onto each other from the bottom up and
 * settle with a short, heavy bounce; then the column is sketched on top.
 */
function strata() {
  const root = $('[data-strata]')
  const courses = $$('.course', root)
  const lines = $$('.shaft path', root)
  const label = $('[data-shaft-label]', root)

  gsap.set(lines, { drawSVG: '0%' })

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: root,
      start: 'top top',
      end: '+=240%',
      pin: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
    },
  })

  courses.forEach((course, i) => {
    tl.from(
      course,
      {
        y: () => -window.innerHeight - i * 40,
        rotation: gsap.utils.random(-2.5, 2.5),
        duration: 0.8,
        ease: 'power3.in',
      },
      i * 0.55,
    )
      .to(course, { scaleY: 0.92, duration: 0.08, ease: 'power1.out' })
      .to(course, { scaleY: 1, duration: 0.25, ease: 'back.out(3)' })
      .from($('.course__numeral', course), { autoAlpha: 0, scale: 0.4, duration: 0.2 }, '<')
  })

  tl.to(lines, { drawSVG: '100%', duration: 1.2, stagger: 0.1, ease: 'power2.inOut' }, '+=0.2')
  tl.from(label, { autoAlpha: 0, y: 20, duration: 0.5 }, '-=0.5')
}

/** Chapter III: bars grow from their start offset, in causal order. */
function trace() {
  const root = $('[data-trace]')
  const bars = $$('.span__bar', root)
  const timings = $$('.span__ms', root)

  const tl = gsap.timeline({
    scrollTrigger: { trigger: root, start: 'top 70%', end: 'bottom 60%', scrub: 0.5 },
  })
  tl.from($$('.span', root), { autoAlpha: 0, x: -16, stagger: 0.05, duration: 0.3 })
    .from(bars, { scaleX: 0, stagger: 0.12, duration: 0.5, ease: 'power2.out' }, 0.2)
    .from(timings, { autoAlpha: 0, stagger: 0.12, duration: 0.3 }, 0.5)
    .from($('[data-log]', root), { autoAlpha: 0, y: 16, duration: 0.4 })
}

function decisions() {
  for (const link of $$('.decision a')) {
    const rule = $('.decision__rule', link)
    const title = $('.decision__title', link)
    const enter = gsap
      .timeline({ paused: true, defaults: { duration: 0.45, ease: 'power3.out' } })
      .to(rule, { scaleX: 1 })
      .to(title, { x: 14, color: '#b5361c' }, 0)
    link.addEventListener('pointerenter', () => enter.play())
    link.addEventListener('pointerleave', () => enter.reverse())
    link.addEventListener('focus', () => enter.play())
    link.addEventListener('blur', () => enter.reverse())
  }

  gsap.from('.decision', {
    autoAlpha: 0,
    y: 30,
    stagger: 0.1,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.decisions', start: 'top 80%' },
  })
}
