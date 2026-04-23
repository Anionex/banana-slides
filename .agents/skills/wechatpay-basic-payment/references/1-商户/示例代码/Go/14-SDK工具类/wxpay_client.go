package wxpay_utility

import (
	"bytes"
	"io"
	"net/http"
)

const Host = "https://api.mch.weixin.qq.com"

// SendGet 发送 GET 请求并返回已验签的应答 Body
func SendGet(config *MchConfig, uri string) ([]byte, error) {
	return sendRequest(config, "GET", uri, nil)
}

// SendPost 发送 POST 请求并返回已验签的应答 Body
func SendPost(config *MchConfig, uri string, reqBody []byte) ([]byte, error) {
	return sendRequest(config, "POST", uri, reqBody)
}

func sendRequest(config *MchConfig, method string, uri string, reqBody []byte) ([]byte, error) {
	var bodyReader io.Reader
	if reqBody != nil {
		bodyReader = bytes.NewReader(reqBody)
	}

	httpRequest, err := http.NewRequest(method, Host+uri, bodyReader)
	if err != nil {
		return nil, err
	}

	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Wechatpay-Serial", config.WechatPayPublicKeyId())

	authorization, err := BuildAuthorization(config.MchId(), config.CertificateSerialNo(),
		config.PrivateKey(), method, uri, reqBody)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Authorization", authorization)

	if reqBody != nil {
		httpRequest.Header.Set("Content-Type", "application/json")
	}

	client := &http.Client{}
	httpResponse, err := client.Do(httpRequest)
	if err != nil {
		return nil, err
	}

	respBody, err := ExtractResponseBody(httpResponse)
	if err != nil {
		return nil, err
	}

	if httpResponse.StatusCode >= 200 && httpResponse.StatusCode < 300 {
		err = ValidateResponse(
			config.WechatPayPublicKeyId(),
			config.WechatPayPublicKey(),
			&httpResponse.Header,
			respBody,
		)
		if err != nil {
			return nil, err
		}
		return respBody, nil
	}

	return nil, NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
}
