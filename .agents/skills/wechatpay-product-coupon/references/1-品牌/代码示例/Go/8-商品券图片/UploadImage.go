package main

import (
	"bytes"
	"demo/wxpay_brand_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/brand/4015826866
	"encoding/json"
	"fmt"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"path/filepath"
)

func main() {
	// TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/brand/4015415289
	config, err := wxpay_brand_utility.CreateBrandConfig(
		"xxxxxxxx",                   // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考 https://pay.weixin.qq.com/doc/brand/4015415289
		"1DDE55AD98Exxxxxxxxxx",      // 品牌API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015407570
		"/path/to/apiclient_key.pem", // 品牌API证书私钥文件路径，本地文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015453439
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径，本地文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &UploadImageRequest{
		Meta: &ImageMeta{
			Filename: wxpay_brand_utility.String("header.jpg"),
			Sha256:   wxpay_brand_utility.String("6aa6c99ce1d04afc2668154126c607af5a680734fa119e2a096529f6d6f2c0a2"),
		},
		File: wxpay_brand_utility.Bytes([]byte("file data")),
	}

	response, err := UploadImage(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func UploadImage(config *wxpay_brand_utility.BrandConfig, request *UploadImageRequest) (response *UploadImageResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/brand/marketing/product-coupon/media/upload-image"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	// 构造 multipart/form-data 请求体
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// todo: your_file_name替换为meta里面的文件名字段
	fileHeader := make(textproto.MIMEHeader)
	fileHeader.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, "your_file_name"))
	ext := filepath.Ext("your_file_name")
	contentType := mime.TypeByExtension(ext)
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	fileHeader.Set("Content-Type", contentType)
	fileWriter, err := writer.CreatePart(fileHeader)
	if err != nil {
		return nil, err
	}
	_, err = fileWriter.Write(*request.File)
	if err != nil {
		return nil, err
	}

	// meta 字段
	metaJSON, err := json.Marshal(request.Meta)
	if err != nil {
		return nil, err
	}
	metaWriter, err := writer.CreateFormField("meta")
	if err != nil {
		return nil, err
	}
	_, err = metaWriter.Write(metaJSON)
	if err != nil {
		return nil, err
	}

	err = writer.Close()
	if err != nil {
		return nil, err
	}
	httpRequest, err := http.NewRequest(method, reqUrl.String(), body)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Wechatpay-Serial", config.WechatPayPublicKeyId())
	httpRequest.Header.Set("Content-Type", writer.FormDataContentType())
	// 签名时使用 meta JSON
	metaJson, err := json.Marshal(request.Meta)
	if err != nil {
		return nil, err
	}
	authorization, err := wxpay_brand_utility.BuildAuthorization(config.BrandId(), config.CertificateSerialNo(), config.PrivateKey(), method, reqUrl.RequestURI(), metaJson)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Authorization", authorization)

	client := &http.Client{}
	httpResponse, err := client.Do(httpRequest)
	if err != nil {
		return nil, err
	}
	respBody, err := wxpay_brand_utility.ExtractResponseBody(httpResponse)
	if err != nil {
		return nil, err
	}
	if httpResponse.StatusCode >= 200 && httpResponse.StatusCode < 300 {
		// 2XX 成功，验证应答签名
		err = wxpay_brand_utility.ValidateResponse(
			config.WechatPayPublicKeyId(),
			config.WechatPayPublicKey(),
			&httpResponse.Header,
			respBody,
		)
		if err != nil {
			return nil, err
		}
		response := &UploadImageResponse{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}

		return response, nil
	} else {
		return nil, wxpay_brand_utility.NewApiException(
			httpResponse.StatusCode,
			httpResponse.Header,
			respBody,
		)
	}
}

type UploadImageRequest struct {
	Meta *ImageMeta `json:"meta,omitempty"`
	File *[]byte    `json:"file,omitempty"`
}

type UploadImageResponse struct {
	ImageUrl *string `json:"image_url,omitempty"`
}

type ImageMeta struct {
	Filename *string `json:"filename,omitempty"`
	Sha256   *string `json:"sha256,omitempty"`
}
