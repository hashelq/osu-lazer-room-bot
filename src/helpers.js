import { FormData } from "node-fetch"

export default {
  genFormData: (data) => {
	const fd = new FormData();
	
	for (const key in data) {
	  fd.set(key, data[key])
	}

	return fd;
  },

  toJSON: (data) => {
	return JSON.stringify(data)
  }
}
