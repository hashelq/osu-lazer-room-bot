const staticGenerator = (base) => {
  return stars => {
    return stars * base
  }
}

const speedGenerator = (base) => {
  return (stars, settings) => {
    return stars * (settings ? settings.speed_change : base)
  }
}

export default {
  "DT": speedGenerator(1.5),
  "NC": speedGenerator(1.5),
  "DC": speedGenerator(0.75),
  "HT": speedGenerator(0.75),
  "HR": staticGenerator(1.10),
  "HD": staticGenerator(1.0),
}
