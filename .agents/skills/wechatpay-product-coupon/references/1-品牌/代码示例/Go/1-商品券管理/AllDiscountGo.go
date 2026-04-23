package main

// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/brand_models_and_client.go
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构

import (
	"demo/wxpay_brand_utility" // 引用微信支付工具库
	"encoding/json"
	"fmt"
)

// 创建商品券 - 单券-全场-折扣券
func main() {
	// TODO: 请准备商户开发必要参数
	config, err := wxpay_brand_utility.CreateBrandConfig(
		"xxxxxxxx",                   // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考
		"1DDE55AD98Exxxxxxxxxx",      // 品牌API证书序列号，如何获取请参考品牌经营平台【安全中心】
		"/path/to/apiclient_key.pem", // 品牌API证书私钥文件路径，本地文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID，如何获取请参考品牌经营平台【安全中心】
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径，本地文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &CreateProductCouponRequest{
		OutRequestNo: wxpay_brand_utility.String("12345_20250101_A3489"), // 必填，创建请求单号，6-40个字符，品牌侧需保持唯一性
		Scope:        PRODUCTCOUPONSCOPE_ALL.Ptr(),                       // 必填，优惠范围：ALL-全场券，SINGLE-单品券
		Type:         PRODUCTCOUPONTYPE_DISCOUNT.Ptr(),                   // 必填，商品券类型：NORMAL-满减券，DISCOUNT-折扣券，EXCHANGE-兑换券
		UsageMode:    USAGEMODE_SINGLE.Ptr(),                             // 必填，使用模式：SINGLE-单券，SEQUENTIAL-多次优惠

		// 【条件必填】单券模式信息
		// 填写条件：当 usage_mode=SINGLE 且 scope=ALL 时必填，用于设置全场券的优惠规则
		// 说明：本示例为全场折扣券，因此需要填写 DiscountCoupon；如果是全场满减券则填写 NormalCoupon
		SingleUsageInfo: &SingleUsageInfo{
			// 【条件必填】折扣券使用规则
			// 填写条件：当 type=DISCOUNT 且 scope=ALL 时必填
			// 说明：如果 type=NORMAL 则需填写 NormalCoupon 而非 DiscountCoupon
			DiscountCoupon: &DiscountCouponUsageRule{
				Threshold:  wxpay_brand_utility.Int64(10000), // 必填，门槛金额(单位：分)，满100元可用；无门槛填0
				PercentOff: wxpay_brand_utility.Int64(20),    // 必填，折扣百分比，20表示减免20%即打8折；30表示减免30%即打7折
			},
		},

		// 必填，商品券展示信息
		DisplayInfo: &ProductCouponDisplayInfo{
			Name:          wxpay_brand_utility.String("全场满100立打8折"),                              // 必填，商品券名称，3-15个字符
			ImageUrl:      wxpay_brand_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 必填，商品券图片URL，需通过图片上传接口获取，建议1080*1080，1:1
			BackgroundUrl: wxpay_brand_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 选填，背景图URL，建议1170*1326，65:77
			DetailImageUrlList: []string{ // 选填，详情图URL列表，最多6张
				"https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx",
			},
			// 【条件必填】以下两个字段仅当 scope=SINGLE(单品券) 时必填，全场券无需填写
			// OriginalPrice: wxpay_brand_utility.Int64(10000),  // 商品原价(单位：分)
			// ComboPackageList: []ComboPackage{...},            // 套餐组合列表
		},

		OutProductNo: wxpay_brand_utility.String("Product_1234567890"), // 选填，商户侧商品券唯一标识

		// 【条件必填】批次信息
		// 填写条件：当 usage_mode=SINGLE 时必填
		// 说明：单券模式必须配置批次信息，包含发放规则、使用规则、展示信息等
		Stock: &StockForCreate{
			Remark:         wxpay_brand_utility.String("8月工作日有效批次"), // 选填，批次备注，最多60个字符
			CouponCodeMode: COUPONCODEMODE_UPLOAD.Ptr(),           // 必填，券码模式：WECHATPAY-微信支付随机生成/UPLOAD-品牌方预上传/API_ASSIGN-品牌方自行指定

			// 必填，批次发放规则
			StockSendRule: &StockSendRule{
				MaxCount:        wxpay_brand_utility.Int64(10000000), // 必填，批次最大发放数量
				MaxCountPerDay:  wxpay_brand_utility.Int64(100000),   // 选填，单日最大发放数量
				MaxCountPerUser: wxpay_brand_utility.Int64(1),        // 必填，单用户最大领取数量
			},

			// 【条件必填】单券使用规则
			// 填写条件：当 usage_mode=SINGLE 时必填
			// 说明：定义券的可用时间范围、周期等规则
			SingleUsageRule: &SingleUsageRule{
				// 必填，券可核销时间
				CouponAvailablePeriod: &SingleCouponAvailablePeriod{
					AvailableBeginTime:   wxpay_brand_utility.String("2025-08-01T00:00:00+08:00"), // 必填，可用开始时间(RFC3339格式)
					AvailableEndTime:     wxpay_brand_utility.String("2025-08-31T23:59:59+08:00"), // 必填，可用结束时间(RFC3339格式)
					AvailableDays:        wxpay_brand_utility.Int64(30),                          // 选填，领取后有效天数，1-365天
					WaitDaysAfterReceive: wxpay_brand_utility.Int64(0),                           // 选填，领取后等待天数，0表示领取后立即可用

					// 选填，每周固定可用时间(如仅工作日可用)
					WeeklyAvailablePeriod: &FixedWeekPeriod{
						// 【条件必填】每周可用星期数
						// 填写条件：当设置了 WeeklyAvailablePeriod 时必填
						DayList: []WeekEnum{
							WEEKENUM_MONDAY,
							WEEKENUM_TUESDAY,
							WEEKENUM_WEDNESDAY,
							WEEKENUM_THURSDAY,
							WEEKENUM_FRIDAY,
						},
						// 选填，每天可用时段列表(如仅10:00-22:00可用)
						// DayPeriodList: []PeriodOfTheDay{...},
					},

					// 选填，不规则可用时间段列表(如特定日期可用)
					IrregularAvailablePeriodList: []TimePeriod{
						{
							BeginTime: wxpay_brand_utility.String("2025-08-15T00:00:00+08:00"), // 必填(列表项内)，开始时间(RFC3339格式)
							EndTime:   wxpay_brand_utility.String("2025-08-15T23:59:59+08:00"), // 必填(列表项内)，结束时间(RFC3339格式)
						},
					},
				},
			},

			// 必填，使用规则展示信息
			UsageRuleDisplayInfo: &UsageRuleDisplayInfo{
				CouponUsageMethodList: []CouponUsageMethod{ // 必填，核销方式列表
					COUPONUSAGEMETHOD_OFFLINE,      // 线下核销
					COUPONUSAGEMETHOD_MINI_PROGRAM, // 小程序核销
					COUPONUSAGEMETHOD_APP,          // APP核销
					COUPONUSAGEMETHOD_PAYMENT_CODE, // 付款码核销
				},
				// 【条件必填】核销小程序AppID
				// 填写条件：当 CouponUsageMethodList 包含 MINI_PROGRAM 时必填
				MiniProgramAppid: wxpay_brand_utility.String("wx1234567890"),
				// 【条件必填】核销小程序路径
				// 填写条件：当 CouponUsageMethodList 包含 MINI_PROGRAM 时必填
				MiniProgramPath: wxpay_brand_utility.String("/pages/index/product"),
				// 【条件必填】核销APP路径
				// 填写条件：当 CouponUsageMethodList 包含 APP 时必填
				AppPath: wxpay_brand_utility.String("pages/index/product"),

				UsageDescription: wxpay_brand_utility.String("工作日可用"), // 选填，使用说明

				// 选填，可用门店信息(用于展示门店相关说明)
				CouponAvailableStoreInfo: &CouponAvailableStoreInfo{
					Description:      wxpay_brand_utility.String("所有门店可用，可使用小程序查看门店列表"), // 选填，可用门店描述
					MiniProgramAppid: wxpay_brand_utility.String("wx1234567890"),          // 选填，门店小程序AppID
					MiniProgramPath:  wxpay_brand_utility.String("/pages/index/store-list"), // 选填，门店小程序路径
				},
			},

			// 必填，用户券展示信息
			CouponDisplayInfo: &CouponDisplayInfo{
				CodeDisplayMode: COUPONCODEDISPLAYMODE_QRCODE.Ptr(),      // 必填，券码展示模式：INVISIBLE-不展示/BARCODE-条形码/QRCODE-二维码
				BackgroundColor: wxpay_brand_utility.String("Color010"), // 选填，背景颜色

				// 选填，小程序入口(用户点击可跳转到指定小程序)
				EntranceMiniProgram: &EntranceMiniProgram{
					Appid:           wxpay_brand_utility.String("wx1234567890"),         // 【条件必填】填写条件：当设置了 EntranceMiniProgram 时必填
					Path:            wxpay_brand_utility.String("/pages/index/product"), // 【条件必填】填写条件：当设置了 EntranceMiniProgram 时必填
					EntranceWording: wxpay_brand_utility.String("欢迎选购"),                 // 【条件必填】填写条件：当设置了 EntranceMiniProgram 时必填
					GuidanceWording: wxpay_brand_utility.String("获取更多优惠"),               // 选填，引导文案
				},

				// 选填，公众号入口(用户点击可跳转到指定公众号)
				EntranceOfficialAccount: &EntranceOfficialAccount{
					Appid: wxpay_brand_utility.String("wx1234567890"), // 【条件必填】填写条件：当设置了 EntranceOfficialAccount 时必填
				},

				// 选填，视频号入口(用户点击可跳转到指定视频号)
				EntranceFinder: &EntranceFinder{
					FinderId:                 wxpay_brand_utility.String("gh_12345678"),                                   // 【条件必填】填写条件：当设置了 EntranceFinder 时必填
					FinderVideoId:            wxpay_brand_utility.String("UDFsdf24df34dD456Hdf34"),                        // 选填，视频号视频ID
					FinderVideoCoverImageUrl: wxpay_brand_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 选填，视频封面图URL
				},
			},

			// 选填，事件通知配置(用于接收券相关事件通知)
			NotifyConfig: &NotifyConfig{
				NotifyAppid: wxpay_brand_utility.String("wx4fd12345678"), // 【条件必填】填写条件：当设置了 NotifyConfig 时必填
			},

			StoreScope: STOCKSTORESCOPE_NONE.Ptr(), // 必填，门店适用范围：NONE-不限制/ALL-全部门店/SPECIFIC-指定门店
		},
	}

	response, err := CreateProductCoupon(config, request)
	if err != nil {
		fmt.Printf("全场折扣券创建失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("全场折扣券创建成功: %s\n", *response.ProductCouponId)
}
