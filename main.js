const requestURL = ''
const request = new XMLHttpRequest()
console.log(requestURL)

request.open('GET', requestURL)
request.responseType = 'json'
request.send()
request.onload = () => {
  const offices = request.response

  console.log({offices})
}