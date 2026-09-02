const assert = require("node:assert/strict");
const { Given, Then, When } = require("@cucumber/cucumber");

const registerFormula = require("../../dist/extension.js").default;
const { fakePi, startWithKitty } = require("../../test/support/fake-pi");

function imageCount(rendered) {
  return rendered.split("\x1b_Ga=T,f=100").length - 1;
}

function transform(world, latex) {
  world.rendered = world.pi.transformer()(`$$${latex}$$`, {
    messageType: "assistant",
    isStreaming: false,
    availableWidth: 80,
  });
}

Given("画像経路で text を組版できる Pi がある", async function () {
  this.pi = fakePi();
  registerFormula(this.pi.api);
  this.started = await startWithKitty(this.pi);
});

When("日本語の text を含む表示数式を変換する", function () {
  transform(this, "A(j)=\\begin{cases}0&\\text{それ以外}\\end{cases}");
});

Then("日本語を含む表示数式が画像になる", function () {
  assert.equal(imageCount(this.rendered), 1);
});

When("ASCII の text を含む表示数式を変換する", function () {
  transform(this, "A(j)=\\begin{cases}0&\\text{otherwise}\\end{cases}");
});

Then("ASCII を含む表示数式が画像になる", function () {
  assert.equal(imageCount(this.rendered), 1);
});

When("表示数式を変換して formula status を実行する", async function () {
  transform(this, "\\text{解}");
  await this.pi.commands.get("formula").handler("status", this.started.ctx);
  this.status = this.started.widgets.get("pi-formula-status");
});

Then("選ばれたセリフ体またはシステムの代替が表示される", function () {
  assert.equal(
    this.status.some((line) =>
      /^serif: (Noto Serif CJK JP|Source Han Serif JP|Source Han Serif|IPAexMincho|system fallback)$/u.test(
        line,
      ),
    ),
    true,
  );
});
