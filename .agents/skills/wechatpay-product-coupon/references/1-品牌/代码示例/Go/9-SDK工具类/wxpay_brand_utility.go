package wxpay_brand_utility

import (
	"bytes"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"hash"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/tjfoc/gmsm/sm3"
)

// BrandConfig 品牌信息配置，用于调用品牌API
type BrandConfig struct {
	brandId                    string
	certificateSerialNo        string
	privateKeyFilePath         string
	wechatPayPublicKeyId       string
	wechatPayPublicKeyFilePath string
	privateKey                 *rsa.PrivateKey
	wechatPayPublicKey         *rsa.PublicKey
}

// BrandId 品牌ID
func (c *BrandConfig) BrandId() string {
	return c.brandId
}

// CertificateSerialNo 品牌API证书序列号
func (c *BrandConfig) CertificateSerialNo() string {
	return c.certificateSerialNo
}

// PrivateKey 品牌API证书对应的私钥
func (c *BrandConfig) PrivateKey() *rsa.PrivateKey {
	return c.privateKey
}

// WechatPayPublicKeyId 微信支付公钥ID
func (c *BrandConfig) WechatPayPublicKeyId() string {
	return c.wechatPayPublicKeyId
}

// WechatPayPublicKey 微信支付公钥
func (c *BrandConfig) WechatPayPublicKey() *rsa.PublicKey {
	return c.wechatPayPublicKey
}

// CreateBrandConfig BrandConfig 构造函数
func CreateBrandConfig(
	brandId string,
	certificateSerialNo string,
	privateKeyFilePath string,
	wechatPayPublicKeyId string,
	wechatPayPublicKeyFilePath string,
) (*BrandConfig, error) {
	BrandConfig := &BrandConfig{
		brandId:                    brandId,
		certificateSerialNo:        certificateSerialNo,
		privateKeyFilePath:         privateKeyFilePath,
		wechatPayPublicKeyId:       wechatPayPublicKeyId,
		wechatPayPublicKeyFilePath: wechatPayPublicKeyFilePath,
	}
	privateKey, err := LoadPrivateKeyWithPath(BrandConfig.privateKeyFilePath)
	if err != nil {
		return nil, err
	}
	BrandConfig.privateKey = privateKey
	wechatPayPublicKey, err := LoadPublicKeyWithPath(BrandConfig.wechatPayPublicKeyFilePath)
	if err != nil {
		return nil, err
	}
	BrandConfig.wechatPayPublicKey = wechatPayPublicKey
	return BrandConfig, nil
}

// LoadPrivateKey 通过私钥的文本内容加载私钥
func LoadPrivateKey(privateKeyStr string) (privateKey *rsa.PrivateKey, err error) {
	block, _ := pem.Decode([]byte(privateKeyStr))
	if block == nil {
		return nil, fmt.Errorf("decode private key err")
	}
	if block.Type != "PRIVATE KEY" {
		return nil, fmt.Errorf("the kind of PEM should be PRIVATE KEY")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse private key err:%s", err.Error())
	}
	privateKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("not a RSA private key")
	}
	return privateKey, nil
}

// LoadPublicKey 通过公钥的文本内容加载公钥
func LoadPublicKey(publicKeyStr string) (publicKey *rsa.PublicKey, err error) {
	block, _ := pem.Decode([]byte(publicKeyStr))
	if block == nil {
		return nil, errors.New("decode public key error")
	}
	if block.Type != "PUBLIC KEY" {
		return nil, fmt.Errorf("the kind of PEM should be PUBLIC KEY")
	}
	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse public key err:%s", err.Error())
	}
	publicKey, ok := key.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("%s is not rsa public key", publicKeyStr)
	}
	return publicKey, nil
}

// LoadPrivateKeyWithPath 通过私钥的文件路径内容加载私钥
func LoadPrivateKeyWithPath(path string) (privateKey *rsa.PrivateKey, err error) {
	privateKeyBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read private pem file err:%s", err.Error())
	}
	return LoadPrivateKey(string(privateKeyBytes))
}

// LoadPublicKeyWithPath 通过公钥的文件路径加载公钥
func LoadPublicKeyWithPath(path string) (publicKey *rsa.PublicKey, err error) {
	publicKeyBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read certificate pem file err:%s", err.Error())
	}
	return LoadPublicKey(string(publicKeyBytes))
}

// EncryptOAEPWithPublicKey 使用 OAEP padding方式用公钥进行加密
func EncryptOAEPWithPublicKey(message string, publicKey *rsa.PublicKey) (ciphertext string, err error) {
	if publicKey == nil {
		return "", fmt.Errorf("you should input *rsa.PublicKey")
	}
	ciphertextByte, err := rsa.EncryptOAEP(sha1.New(), rand.Reader, publicKey, []byte(message), nil)
	if err != nil {
		return "", fmt.Errorf("encrypt message with public key err:%s", err.Error())
	}
	ciphertext = base64.StdEncoding.EncodeToString(ciphertextByte)
	return ciphertext, nil
}

// DecryptAES256GCM 使用 AEAD_AES_256_GCM 算法进行解密
//
// 可以使用此算法完成微信支付回调报文解密
func DecryptAES256GCM(aesKey, associatedData, nonce, ciphertext string) (plaintext string, err error) {
	decodedCiphertext, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	c, err := aes.NewCipher([]byte(aesKey))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(c)
	if err != nil {
		return "", err
	}
	dataBytes, err := gcm.Open(nil, []byte(nonce), decodedCiphertext, []byte(associatedData))
	if err != nil {
		return "", err
	}
	return string(dataBytes), nil
}

// SignSHA256WithRSA 通过私钥对字符串以 SHA256WithRSA 算法生成签名信息
func SignSHA256WithRSA(source string, privateKey *rsa.PrivateKey) (signature string, err error) {
	if privateKey == nil {
		return "", fmt.Errorf("private key should not be nil")
	}
	h := crypto.Hash.New(crypto.SHA256)
	_, err = h.Write([]byte(source))
	if err != nil {
		return "", err
	}
	hashed := h.Sum(nil)
	signatureByte, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hashed)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signatureByte), nil
}

// VerifySHA256WithRSA 通过公钥对字符串和签名结果以 SHA256WithRSA 验证签名有效性
func VerifySHA256WithRSA(source string, signature string, publicKey *rsa.PublicKey) error {
	if publicKey == nil {
		return fmt.Errorf("public key should not be nil")
	}

	sigBytes, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return fmt.Errorf("verify failed: signature is not base64 encoded")
	}
	hashed := sha256.Sum256([]byte(source))
	err = rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hashed[:], sigBytes)
	if err != nil {
		return fmt.Errorf("verify signature with public key error:%s", err.Error())
	}
	return nil
}

// GenerateNonce 生成一个长度为 NonceLength 的随机字符串（只包含大小写字母与数字）
func GenerateNonce() (string, error) {
	const (
		// NonceSymbols 随机字符串可用字符集
		NonceSymbols = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
		// NonceLength 随机字符串的长度
		NonceLength = 32
	)

	bytes := make([]byte, NonceLength)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}
	symbolsByteLength := byte(len(NonceSymbols))
	for i, b := range bytes {
		bytes[i] = NonceSymbols[b%symbolsByteLength]
	}
	return string(bytes), nil
}

// BuildAuthorization 构建请求头中的 Authorization 信息
func BuildAuthorization(
	brandId string,
	certificateSerialNo string,
	privateKey *rsa.PrivateKey,
	method string,
	canonicalURL string,
	body []byte,
) (string, error) {
	const (
		SignatureMessageFormat = "%s\n%s\n%d\n%s\n%s\n" // 数字签名原文格式
		// HeaderAuthorizationFormat 请求头中的 Authorization 拼接格式
		HeaderAuthorizationFormat = "WECHATPAY-BRAND-SHA256-RSA2048 brand_id=\"%s\",nonce_str=\"%s\",timestamp=\"%d\",serial_no=\"%s\",signature=\"%s\""
	)

	nonce, err := GenerateNonce()
	if err != nil {
		return "", err
	}
	timestamp := time.Now().Unix()
	message := fmt.Sprintf(SignatureMessageFormat, method, canonicalURL, timestamp, nonce, body)
	signature, err := SignSHA256WithRSA(message, privateKey)
	if err != nil {
		return "", err
	}
	authorization := fmt.Sprintf(
		HeaderAuthorizationFormat,
		brandId, nonce, timestamp, certificateSerialNo, signature,
	)
	return authorization, nil
}

// ExtractResponseBody 提取应答报文的 Body
func ExtractResponseBody(response *http.Response) ([]byte, error) {
	if response.Body == nil {
		return nil, nil
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body err:[%s]", err.Error())
	}
	response.Body = io.NopCloser(bytes.NewBuffer(body))
	return body, nil
}

const (
	WechatPayTimestamp = "Wechatpay-Timestamp" // 微信支付回包时间戳
	WechatPayNonce     = "Wechatpay-Nonce"     // 微信支付回包随机字符串
	WechatPaySignature = "Wechatpay-Signature" // 微信支付回包签名信息
	WechatPaySerial    = "Wechatpay-Serial"    // 微信支付回包平台序列号
	RequestID          = "Request-Id"          // 微信支付回包请求ID
)

func validateWechatPaySignature(
	wechatpayPublicKeyId string,
	wechatpayPublicKey *rsa.PublicKey,
	headers *http.Header,
	body []byte,
) error {
	timestampStr := headers.Get(WechatPayTimestamp)
	serialNo := headers.Get(WechatPaySerial)
	signature := headers.Get(WechatPaySignature)
	nonce := headers.Get(WechatPayNonce)

	// 拒绝过期请求
	timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid timestamp: %w", err)
	}
	if time.Now().Sub(time.Unix(timestamp, 0)) > 5*time.Minute {
		return fmt.Errorf("timestamp expired: %d", timestamp)
	}

	if serialNo != wechatpayPublicKeyId {
		return fmt.Errorf(
			"serial-no mismatch: got %s, expected %s",
			serialNo,
			wechatpayPublicKeyId,
		)
	}

	message := fmt.Sprintf("%s\n%s\n%s\n", timestampStr, nonce, body)
	if err := VerifySHA256WithRSA(message, signature, wechatpayPublicKey); err != nil {
		return fmt.Errorf("invalid signature: %v", err)
	}

	return nil
}

// ValidateResponse 验证微信支付回包的签名信息
func ValidateResponse(
	wechatpayPublicKeyId string,
	wechatpayPublicKey *rsa.PublicKey,
	headers *http.Header,
	body []byte,
) error {
	if err := validateWechatPaySignature(wechatpayPublicKeyId, wechatpayPublicKey, headers, body); err != nil {
		return fmt.Errorf("validate response err: %w, RequestID: %s", err, headers.Get(RequestID))
	}
	return nil
}

func validateNotification(
	wechatpayPublicKeyId string,
	wechatpayPublicKey *rsa.PublicKey,
	headers *http.Header,
	body []byte,
) error {
	if err := validateWechatPaySignature(wechatpayPublicKeyId, wechatpayPublicKey, headers, body); err != nil {
		return fmt.Errorf("validate notification err: %w", err)
	}
	return nil
}

// Resource 微信支付通知请求中的资源数据
type Resource struct {
	Algorithm      string `json:"algorithm"`
	Ciphertext     string `json:"ciphertext"`
	AssociatedData string `json:"associated_data"`
	Nonce          string `json:"nonce"`
	OriginalType   string `json:"original_type"`
}

// Notification 微信支付通知的数据结构
type Notification struct {
	ID           string     `json:"id"`
	CreateTime   *time.Time `json:"create_time"`
	EventType    string     `json:"event_type"`
	ResourceType string     `json:"resource_type"`
	Resource     *Resource  `json:"resource"`
	Summary      string     `json:"summary"`

	Plaintext string // 解密后的业务数据（JSON字符串）
}

func (c *Notification) validate() error {
	if c.Resource == nil {
		return errors.New("resource is nil")
	}

	if c.Resource.Algorithm != "AEAD_AES_256_GCM" {
		return fmt.Errorf("unsupported algorithm: %s", c.Resource.Algorithm)
	}

	if c.Resource.Ciphertext == "" {
		return errors.New("ciphertext is empty")
	}

	if c.Resource.AssociatedData == "" {
		return errors.New("associated_data is empty")
	}

	if c.Resource.Nonce == "" {
		return errors.New("nonce is empty")
	}

	if c.Resource.OriginalType == "" {
		return fmt.Errorf("original_type is empty")
	}

	return nil
}

func (c *Notification) decrypt(apiv3Key string) error {
	if err := c.validate(); err != nil {
		return fmt.Errorf("notification format err: %w", err)
	}

	plaintext, err := DecryptAES256GCM(
		apiv3Key,
		c.Resource.AssociatedData,
		c.Resource.Nonce,
		c.Resource.Ciphertext,
	)
	if err != nil {
		return fmt.Errorf("notification decrypt err: %w", err)
	}

	c.Plaintext = plaintext
	return nil
}

// ParseNotification 解析微信支付通知的报文，返回通知中的业务数据
// Notification.PlainText 为解密后的业务数据JSON字符串，请自行反序列化后使用
func ParseNotification(
	wechatpayPublicKeyId string,
	wechatpayPublicKey *rsa.PublicKey,
	apiv3Key string,
	headers *http.Header,
	body []byte,
) (*Notification, error) {
	if err := validateNotification(wechatpayPublicKeyId, wechatpayPublicKey, headers, body); err != nil {
		return nil, err
	}

	notification := &Notification{}
	if err := json.Unmarshal(body, notification); err != nil {
		return nil, fmt.Errorf("parse notification err: %w", err)
	}

	if err := notification.decrypt(apiv3Key); err != nil {
		return nil, fmt.Errorf("notification decrypt err: %w", err)
	}

	return notification, nil
}

// ApiException 微信支付API错误异常，发送HTTP请求成功，但返回状态码不是 2XX 时抛出本异常
type ApiException struct {
	statusCode   int         // 应答报文的 HTTP 状态码
	header       http.Header // 应答报文的 Header 信息
	body         []byte      // 应答报文的 Body 原文
	errorCode    string      // 微信支付回包的错误码
	errorMessage string      // 微信支付回包的错误信息
}

func (c *ApiException) Error() string {
	buf := bytes.NewBuffer(nil)
	buf.WriteString(fmt.Sprintf("api error:[StatusCode: %d, Body: %s", c.statusCode, string(c.body)))
	if len(c.header) > 0 {
		buf.WriteString(" Header: ")
		for key, value := range c.header {
			buf.WriteString(fmt.Sprintf("\n - %v=%v", key, value))
		}
		buf.WriteString("\n")
	}
	buf.WriteString("]")
	return buf.String()
}

func (c *ApiException) StatusCode() int {
	return c.statusCode
}

func (c *ApiException) Header() http.Header {
	return c.header
}

func (c *ApiException) Body() []byte {
	return c.body
}

func (c *ApiException) ErrorCode() string {
	return c.errorCode
}

func (c *ApiException) ErrorMessage() string {
	return c.errorMessage
}

func NewApiException(statusCode int, header http.Header, body []byte) error {
	ret := &ApiException{
		statusCode: statusCode,
		header:     header,
		body:       body,
	}

	bodyObject := map[string]interface{}{}
	if err := json.Unmarshal(body, &bodyObject); err == nil {
		if val, ok := bodyObject["code"]; ok {
			ret.errorCode = val.(string)
		}
		if val, ok := bodyObject["message"]; ok {
			ret.errorMessage = val.(string)
		}
	}

	return ret
}

// Time 复制 time.Time 对象，并返回复制体的指针
func Time(t time.Time) *time.Time {
	return &t
}

// String 复制 string 对象，并返回复制体的指针
func String(s string) *string {
	return &s
}

// Bytes 复制 []byte 对象，并返回复制体的指针
func Bytes(b []byte) *[]byte {
	return &b
}

// Bool 复制 bool 对象，并返回复制体的指针
func Bool(b bool) *bool {
	return &b
}

// Float64 复制 float64 对象，并返回复制体的指针
func Float64(f float64) *float64 {
	return &f
}

// Float32 复制 float32 对象，并返回复制体的指针
func Float32(f float32) *float32 {
	return &f
}

// Int64 复制 int64 对象，并返回复制体的指针
func Int64(i int64) *int64 {
	return &i
}

// Int32 复制 int64 对象，并返回复制体的指针
func Int32(i int32) *int32 {
	return &i
}

// generateHashFromStream 从io.Reader流中生成哈希值的通用函数
func generateHashFromStream(reader io.Reader, hashFunc func() hash.Hash, algorithmName string) (string, error) {
	hash := hashFunc()
	if _, err := io.Copy(hash, reader); err != nil {
		return "", fmt.Errorf("failed to read stream for %s: %w", algorithmName, err)
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// GenerateSHA256FromStream 从io.Reader流中生成SHA256哈希值
func GenerateSHA256FromStream(reader io.Reader) (string, error) {
	return generateHashFromStream(reader, sha256.New, "SHA256")
}

// GenerateSHA1FromStream 从io.Reader流中生成SHA1哈希值
func GenerateSHA1FromStream(reader io.Reader) (string, error) {
	return generateHashFromStream(reader, sha1.New, "SHA1")
}

// GenerateSM3FromStream 从io.Reader流中生成SM3哈希值
func GenerateSM3FromStream(reader io.Reader) (string, error) {
	h := sm3.New()
	if _, err := io.Copy(h, reader); err != nil {
		return "", fmt.Errorf("failed to read stream for SM3: %w", err)
	}
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}
