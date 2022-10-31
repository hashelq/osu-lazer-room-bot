import { FormData } from "node-fetch"

export default {
  fmtMSS: (s) => {
	return(s-(s%=60))/60+(9<s?':':':0')+s
  },
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
