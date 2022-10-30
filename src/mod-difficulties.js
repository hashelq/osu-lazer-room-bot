const static_generator = (base) => {
  return stars => { return stars * base }
}

const speed_generator = (base) => {
  return (stars, settings) => { return stars * (settings ? settings.speed_change : base) }
}

export default {
  "DT": speed_generator(1.5),
  "NC": speed_generator(1.5),
  "DC": speed_generator(0.75),
  "HT": speed_generator(0.75),
  "HR": static_generator(1.10),
  "HD": static_generator(1.0),
}

