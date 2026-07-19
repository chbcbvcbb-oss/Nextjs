import {
  durationToString,
  hrtimeToSeconds,
  hrtimeBigIntDurationToString,
  hrtimeDurationToString,
} from './duration-to-string'

describe('durationToString', () => {
  describe('minutes range (> 120 seconds)', () => {
    it('formats durations above two minutes in minutes with one decimal', () => {
      expect(durationToString(150)).toBe('2.5min')
      expect(durationToString(121)).toBe('2.0min')
      expect(durationToString(3600)).toBe('60.0min')
    })

    it('treats exactly 120 seconds as seconds, not minutes (strict >)', () => {
      expect(durationToString(120)).toBe('120s')
    })
  })

  describe('whole-seconds range (> 40 seconds)', () => {
    it('formats durations above forty seconds in whole seconds', () => {
      expect(durationToString(45)).toBe('45s')
      expect(durationToString(41)).toBe('41s')
    })

    it('rounds to the nearest whole second', () => {
      expect(durationToString(45.4)).toBe('45s')
      expect(durationToString(45.6)).toBe('46s')
    })

    it('can round up to 120s at the upper boundary without switching to minutes', () => {
      expect(durationToString(119.6)).toBe('120s')
    })

    it('treats exactly 40 seconds as decimal seconds, not whole seconds (strict >)', () => {
      expect(durationToString(40)).toBe('40.0s')
    })
  })

  describe('decimal-seconds range (> 2 seconds)', () => {
    it('formats durations above two seconds with one decimal place', () => {
      expect(durationToString(3.21)).toBe('3.2s')
      expect(durationToString(2.1)).toBe('2.1s')
      expect(durationToString(39.99)).toBe('40.0s')
    })

    it('treats exactly 2 seconds as milliseconds, not seconds (strict >)', () => {
      expect(durationToString(2)).toBe('2000.0ms')
    })
  })

  describe('milliseconds range (<= 2 seconds)', () => {
    it('formats sub-two-second durations in milliseconds with one decimal', () => {
      expect(durationToString(1.5)).toBe('1500.0ms')
      expect(durationToString(0.25)).toBe('250.0ms')
      expect(durationToString(0.0015)).toBe('1.5ms')
    })

    it('formats zero as 0.0ms', () => {
      expect(durationToString(0)).toBe('0.0ms')
    })

    it('formats sub-millisecond durations without switching units', () => {
      expect(durationToString(0.0000005)).toBe('0.0ms')
    })

    it('formats negative durations in milliseconds (no clamping)', () => {
      expect(durationToString(-0.5)).toBe('-500.0ms')
    })
  })
})

describe('hrtimeToSeconds', () => {
  it('converts a [seconds, nanoseconds] tuple to fractional seconds', () => {
    expect(hrtimeToSeconds([1, 500_000_000])).toBe(1.5)
  })

  it('handles a zero tuple', () => {
    expect(hrtimeToSeconds([0, 0])).toBe(0)
  })

  it('handles nanoseconds only', () => {
    expect(hrtimeToSeconds([0, 1])).toBe(1e-9)
  })

  it('handles the maximum nanosecond component without carrying', () => {
    expect(hrtimeToSeconds([2, 999_999_999])).toBeCloseTo(2.999999999, 9)
  })
})

describe('hrtimeBigIntDurationToString', () => {
  describe('minutes range (>= 2 minutes)', () => {
    it('formats two minutes and above in minutes with one decimal', () => {
      expect(hrtimeBigIntDurationToString(150_000_000_000n)).toBe('2.5min')
      expect(hrtimeBigIntDurationToString(600_000_000_000n)).toBe('10.0min')
    })

    it('includes exactly 2 minutes in the minutes range (inclusive >=)', () => {
      // Note: differs from durationToString, where 120s formats as "120s"
      expect(hrtimeBigIntDurationToString(120_000_000_000n)).toBe('2.0min')
    })
  })

  describe('whole-seconds range (>= 40 seconds)', () => {
    it('formats forty seconds and above in whole seconds', () => {
      expect(hrtimeBigIntDurationToString(45_000_000_000n)).toBe('45s')
      expect(hrtimeBigIntDurationToString(119_000_000_000n)).toBe('119s')
    })

    it('includes exactly 40 seconds in the whole-seconds range (inclusive >=)', () => {
      // Note: differs from durationToString, where 40s formats as "40.0s"
      expect(hrtimeBigIntDurationToString(40_000_000_000n)).toBe('40s')
    })
  })

  describe('decimal-seconds range (>= 2 seconds)', () => {
    it('formats two seconds and above with one decimal place', () => {
      expect(hrtimeBigIntDurationToString(3_210_000_000n)).toBe('3.2s')
      expect(hrtimeBigIntDurationToString(39_990_000_000n)).toBe('40.0s')
    })

    it('includes exactly 2 seconds in the seconds range (inclusive >=)', () => {
      // Note: differs from durationToString, where 2s formats as "2000.0ms"
      expect(hrtimeBigIntDurationToString(2_000_000_000n)).toBe('2.0s')
    })
  })

  describe('milliseconds range (>= 2 milliseconds)', () => {
    it('formats two milliseconds and above in whole milliseconds', () => {
      expect(hrtimeBigIntDurationToString(250_000_000n)).toBe('250ms')
      expect(hrtimeBigIntDurationToString(2_000_000n)).toBe('2ms')
    })

    it('rounds to the nearest whole millisecond', () => {
      expect(hrtimeBigIntDurationToString(2_400_000n)).toBe('2ms')
      expect(hrtimeBigIntDurationToString(2_600_000n)).toBe('3ms')
    })
  })

  describe('microseconds range (< 2 milliseconds)', () => {
    it('formats sub-two-millisecond durations in whole microseconds', () => {
      expect(hrtimeBigIntDurationToString(500_000n)).toBe('500µs')
      expect(hrtimeBigIntDurationToString(1_000n)).toBe('1µs')
    })

    it('rounds microseconds, so just below the 2ms threshold reads as 2000µs', () => {
      expect(hrtimeBigIntDurationToString(1_999_999n)).toBe('2000µs')
    })

    it('formats zero as 0µs', () => {
      expect(hrtimeBigIntDurationToString(0n)).toBe('0µs')
    })

    it('rounds sub-microsecond durations to whole microseconds', () => {
      expect(hrtimeBigIntDurationToString(400n)).toBe('0µs')
      expect(hrtimeBigIntDurationToString(999n)).toBe('1µs')
    })
  })
})

describe('hrtimeDurationToString', () => {
  it('formats a tuple via the seconds-based formatter', () => {
    expect(hrtimeDurationToString([0, 5_000_000])).toBe('5.0ms')
    expect(hrtimeDurationToString([45, 0])).toBe('45s')
    expect(hrtimeDurationToString([180, 0])).toBe('3.0min')
  })

  it('combines seconds and nanoseconds before formatting', () => {
    expect(hrtimeDurationToString([2, 500_000_000])).toBe('2.5s')
  })

  it('uses the strict thresholds of the seconds-based formatter', () => {
    expect(hrtimeDurationToString([2, 0])).toBe('2000.0ms')
    expect(hrtimeDurationToString([40, 0])).toBe('40.0s')
    expect(hrtimeDurationToString([120, 0])).toBe('120s')
  })
})
