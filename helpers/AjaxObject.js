// @flow

export type AjaxObject = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  data?: any
}
