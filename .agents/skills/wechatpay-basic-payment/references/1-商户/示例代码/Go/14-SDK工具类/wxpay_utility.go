package wxpay_utility

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

type MchConfig struct {
	mchId                      string
	certificateSerialNo        string
	privateKeyFilePath         string
	wechatPayPublicKeyId       string
	wechatPayPublicKeyFilePath string
	privateKey                 *rsa.PrivateKey
	wechatPayPublicKey         *rsa.PublicKey
}

func (c *MchConfig) MchId() string {
	return c.mchId
}

func (c *MchConfig) CertificateSerialNo() string {
	return c.certificateSerialNo
}

func (c *MchConfig) PrivateKey() *rsa.PrivateKey {
	return c.privateKey
}

func (c *MchConfig) WechatPayPublicKeyId() string {
	return c.wechatPayPublicKeyId
}

func (c *MchConfig) WechatPayPublicKey() *rsa.PublicKey {
	return c.wechatPayPublicKey
}

func CreateMchConfig(
	mchId string,
	certificateSerialNo string,
	privateKeyFilePath string,
	wechatPayPublicKeyId string,
	wechatPayPublicKeyFilePath string,
) (*MchConfig, error) {
	mchConfig := &MchConfig{
		mchId:                      mchId,
		certificateSerialNo:        certificateSerialNo,
		privateKeyFilePath:         privateKeyFilePath,
		wechatPayPublicKeyId:       wechatPayPublicKeyId,
		wechatPayPublicKeyFilePath: wechatPayPublicKeyFilePath,
	}
	privateKey, err := LoadPrivateKeyWithPath(mchConfig.privateKeyFilePath)
	if err != nil {
		return nil, err
	}
	mchConfig.privateKey = privateKey
	wechatPayPublicKey, err := LoadPublicKeyWithPath(mchConfig.wechatPayPublicKeyFilePath)
	if err != nil {
		return nil, err
	}
	mchConfig.wechatPayPublicKey = wechatPayPublicKey
	return mchConfig, nil
}

func LoadPrivateKey(privateKeyStr string) (privateKey *rsa.PrivateKey, err error) {
	block, _ := pem.Decode([]byte(privateKeyStr))
	if block == nil {
		return nil, fmt.Errorf("decode private key err")
	}
	if block.Type != "PRIVATE KEY" {
		return nil, fmt.Errorf("the kind of PEM should be PRVATE KEY")
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

func LoadPrivateKeyWithPath(path string) (privateKey *rsa.PrivateKey, err error) {
	privateKeyBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read private pem file err:%s", err.Error())
	}
	return LoadPrivateKey(string(privateKeyBytes))
}

func LoadPublicKeyWithPath(path string) (publicKey *rsa.PublicKey, err error) {
	publicKeyBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read certificate pem file err:%s", err.Error())
	}
	return LoadPublicKey(string(publicKeyBytes))
}

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

func SignSHA256WithRSA(source string, privateKey *rsa.PrivateKey) (signature string, err error) {
	if privateKey == nil {
		return "", fmt.Errorf("private key should not be nil")
	}
	h := crypto.Hash.New(crypto.SHA256)
	_, err = h.Write([]byte(source))
	if err != nil {
		return "", nil
	}
	hashed := h.Sum(nil)
	signatureByte, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hashed)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signatureByte), nil
}

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

func GenerateNonce() (string, error) {
	const (
		NonceSymbols = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
		NonceLength  = 32
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

func BuildAuthorization(
	mchid string,
	certificateSerialNo string,
	privateKey *rsa.PrivateKey,
	method string,
	canonicalURL string,
	body []byte,
) (string, error) {
	const (
		SignatureMessageFormat   = "%s\n%s\n%d\n%s\n%s\n"
		HeaderAuthorizationFormat = "WECHATPAY2-SHA256-RSA2048 mchid=\"%s\",nonce_str=\"%s\",timestamp=\"%d\",serial_no=\"%s\",signature=\"%s\""
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
		mchid, nonce, timestamp, certificateSerialNo, signature,
	)
	return authorization, nil
}

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
	WechatPayTimestamp = "Wechatpay-Timestamp"
	WechatPayNonce     = "Wechatpay-Nonce"
	WechatPaySignature = "Wechatpay-Signature"
	WechatPaySerial    = "Wechatpay-Serial"
	RequestID          = "Request-Id"
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

type Resource struct {
	Algorithm      string `json:"algorithm"`
	Ciphertext     string `json:"ciphertext"`
	AssociatedData string `json:"associated_data"`
	Nonce          string `json:"nonce"`
	OriginalType   string `json:"original_type"`
}

type Notification struct {
	ID           string     `json:"id"`
	CreateTime   *time.Time `json:"create_time"`
	EventType    string     `json:"event_type"`
	ResourceType string     `json:"resource_type"`
	Resource     *Resource  `json:"resource"`
	Summary      string     `json:"summary"`

	Plaintext string
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

type ApiException struct {
	statusCode   int
	header       http.Header
	body         []byte
	errorCode    string
	errorMessage string
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

func Time(t time.Time) *time.Time {
	return &t
}

func String(s string) *string {
	return &s
}

func Bytes(b []byte) *[]byte {
	return &b
}

func Bool(b bool) *bool {
	return &b
}

func Float64(f float64) *float64 {
	return &f
}

func Float32(f float32) *float32 {
	return &f
}

func Int64(i int64) *int64 {
	return &i
}

func Int32(i int32) *int32 {
	return &i
}

func generateHashFromStream(reader io.Reader, hashFunc func() hash.Hash, algorithmName string) (string, error) {
	hash := hashFunc()
	if _, err := io.Copy(hash, reader); err != nil {
		return "", fmt.Errorf("failed to read stream for %s: %w", algorithmName, err)
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

func GenerateSHA256FromStream(reader io.Reader) (string, error) {
	return generateHashFromStream(reader, sha256.New, "SHA256")
}

func GenerateSHA1FromStream(reader io.Reader) (string, error) {
	return generateHashFromStream(reader, sha1.New, "SHA1")
}

func GenerateSM3FromStream(reader io.Reader) (string, error) {
	h := sm3.New()
	if _, err := io.Copy(h, reader); err != nil {
		return "", fmt.Errorf("failed to read stream for SM3: %w", err)
	}
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

